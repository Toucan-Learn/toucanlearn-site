#!/usr/bin/env python3
"""Serial, nice-10 differential renders; never modifies existing scenes or frames.

python3 scripts/diagnose-drink-necks.py
Compare stock settings, larger ray budgets, and fresh Cycles data, at healthy and
failed angles. A passing probe is evidence only; a full 360-frame rerender and
check-drink-necks.py are still required before replacing the website assets.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime

ROOT = Path(__file__).resolve().parents[2] / 'outputs' / 'drinks-blender'
FRAMES = {'skids': [0, 83, 84, 90, 110, 111], 'fizzy': [0, 30, 31, 60, 103, 104],
          'ground-pinch': [0, 102, 103, 110, 119, 0]}


def measure(path):
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path),
                          '-vf', 'crop=40:40:580:165', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                         check=True, stdout=subprocess.PIPE).stdout
    if len(raw) != 4800:
        raise ValueError('Incomplete crop')
    rgb = [sum(raw[channel::3]) / 1600 for channel in range(3)]
    return {'rgb': rgb, 'luma': sum(c * w for c, w in zip(rgb, (.2126, .7152, .0722)))}


def probe(args):
    # Even if nice prints a warning and still launches its child, reject before rendering.
    if os.getpriority(os.PRIO_PROCESS, 0) < 10:
        raise RuntimeError('Rendering requires nice >= 10; no render started')
    import bpy
    import hashlib
    import numpy as np
    spec = importlib.util.spec_from_file_location('drink_builder', args.root / 'build_drinks.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    bpy.ops.wm.open_mainfile(filepath=str(args.root / 'scenes' / f'{args.drink}-spin.blend'))
    scene = bpy.context.scene
    args.destination.mkdir(parents=True, exist_ok=True)
    # Hash actual packed image pixels, not filenames, to guard the current label artwork.
    def image_hashes():
        result = {}
        for image in bpy.data.images:
            if image.type != 'IMAGE' or not image.has_data:
                continue
            pixels = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(pixels)
            result[image.name] = hashlib.sha256(pixels.tobytes()).hexdigest()
        return result
    images = image_hashes()
    camera = {'matrix': [list(row) for row in scene.camera.matrix_world],
              'ortho_scale': scene.camera.data.ortho_scale,
              'resolution': [scene.render.resolution_x, scene.render.resolution_y]}
    if args.mode == 'high-bounces':
        scene.cycles.max_bounces = 32
        scene.cycles.transmission_bounces = 16
        scene.cycles.glossy_bounces = 16
    if args.mode == 'fresh-data':
        scene.render.use_persistent_data = False
    if args.mode == 'cpu':
        scene.cycles.device = 'CPU'
    else:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type == 'METAL'
        if not any(device.use for device in prefs.devices):
            raise RuntimeError('No Metal device; no automatic CPU fallback')
        scene.cycles.device = 'GPU'
    scene.render.threads_mode, scene.render.threads = 'FIXED', 4
    rows = []
    for ordinal, index in enumerate(FRAMES[args.drink]):
        scene.frame_set(index + 1)
        path = args.destination / f'{ordinal:02}-{index:03}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        builder.finish_spin_frame(path)
        row = {'frame': index, 'path': str(path), **measure(path)}
        row['passed'] = row['luma'] >= 60
        rows.append(row)
        print('NECK PROBE', args.drink, args.mode, row, flush=True)
    assert image_hashes() == images, 'Packed artwork changed during the probe'
    result = {'drink': args.drink, 'mode': args.mode, 'camera': camera, 'packed_image_sha256': images,
              'source_scene': str(args.root / 'scenes' / f'{args.drink}-spin.blend'),
              'max_bounces': scene.cycles.max_bounces, 'transmission_bounces': scene.cycles.transmission_bounces,
              'glossy_bounces': scene.cycles.glossy_bounces, 'persistent_data': scene.render.use_persistent_data,
              'frames': rows, 'passed': all(row['passed'] for row in rows)}
    (args.destination / 'report.json').write_text(json.dumps(result, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
    parser.add_argument('--mode', choices=('all', 'stock', 'high-bounces', 'fresh-data', 'cpu'), default='all')
    parser.add_argument('--drink', choices=(*FRAMES, 'all'), default='all')
    parser.add_argument('--probe', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--destination', type=Path, help=argparse.SUPPRESS)
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    args.root = args.root.resolve()
    if args.probe:
        probe(args)
        return
    output = (args.output or args.root.parent / f'drinks-neck-probe-{datetime.now():%Y%m%d-%H%M%S}').resolve()
    output.mkdir(parents=True, exist_ok=False)
    modes = ['stock', 'high-bounces', 'fresh-data'] if args.mode == 'all' else [args.mode]
    drinks = list(FRAMES) if args.drink == 'all' else [args.drink]
    results = []
    # Nice can fail while still executing the child; the Python guard must run first.
    guard = 'import os,sys; assert os.getpriority(os.PRIO_PROCESS,0)>=10, "nice >= 10 required; render not started"; os.execv(sys.argv[1],sys.argv[1:])'
    for drink in drinks:
        for mode in modes:
            destination = output / drink / mode
            command = ['nice', '-n', '10', sys.executable, '-c', guard, args.blender,
                       '-b', '-t', '4', '--python-exit-code', '1', '-P', str(Path(__file__).resolve()),
                       '--', '--probe', '--root', str(args.root), '--drink', drink, '--mode', mode,
                       '--destination', str(destination)]
            print(f'Probe {drink}/{mode}; log: {output / (drink + "-" + mode + ".log")}', flush=True)
            with (output / f'{drink}-{mode}.log').open('w') as log:
                result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
            if result.returncode:
                raise SystemExit(f'Probe stopped (exit {result.returncode}); see {output / (drink + "-" + mode + ".log")}. Existing renders are untouched.')
            result = json.loads((destination / 'report.json').read_text())
            results.append(result)
            print(f'{drink}/{mode}: {"PASS" if result["passed"] else "FAIL"}', flush=True)
    (output / 'report.json').write_text(json.dumps(results, indent=2) + '\n')
    print(f'Comparison saved at {output}; existing renders and website assets are unchanged.')


if __name__ == '__main__':
    main()
