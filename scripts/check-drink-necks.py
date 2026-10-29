#!/usr/bin/env python3
"""Audit all delivered neck/lid crops without Blender or third-party Python modules.

python3 scripts/check-drink-necks.py --assets assets/projects/drinks --report /tmp/necks.json
Exit 1 means a black crop or a >25 luma discontinuity at adjacent angles.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

DRINKS = ('skids', 'fizzy', 'ground-pinch')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit(directory):
    directory = Path(directory)
    if {p.name for p in directory.glob('[0-9][0-9][0-9].webp')} != {f'{i:03}.webp' for i in range(120)}:
        raise ValueError(f'{directory}: expected exactly frames 000..119')
    manifest = json.loads((directory / 'manifest.json').read_text())
    if (manifest['frameCount'], manifest['width'], manifest['height']) != (120, 1200, 900):
        raise ValueError(f'{directory}: frame count or dimensions changed')
    if sha(directory / 'poster.webp') != sha(directory / '000.webp'):
        raise ValueError(f'{directory}: poster does not match frame zero')
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i',
                          str(directory / '%03d.webp'), '-vf', 'crop=40:40:580:165',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                         check=True, stdout=subprocess.PIPE).stdout
    if len(raw) != 120 * 40 * 40 * 3:
        raise ValueError(f'{directory}: incomplete decoded sequence')
    frames = []
    for i in range(120):
        pixels = raw[i * 4800:(i + 1) * 4800]
        rgb = [sum(pixels[channel::3]) / 1600 for channel in range(3)]
        frames.append({'frame': i, 'rgb': rgb,
                       'luma': sum(c * w for c, w in zip(rgb, (.2126, .7152, .0722))),
                       'black_fraction': sum(max(pixels[k:k + 3]) < 35 for k in range(0, 4800, 3)) / 1600,
                       'sha256': sha(directory / f'{i:03}.webp')})
    black = [row['frame'] for row in frames if row['luma'] < 60]
    discontinuities = [i for i in range(120) if abs(frames[i]['luma'] - frames[(i - 1) % 120]['luma']) > 25]
    return {'crop': [580, 165, 40, 40], 'frames': frames, 'below_60': black,
            'adjacent_luma_jumps_above_25': discontinuities,
            'dragDirection': manifest.get('dragDirection', -1),
            'poster_sha256': sha(directory / 'poster.webp'),
            'passed': not black and not discontinuities}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, default=Path('assets/projects/drinks'))
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    results = {drink: audit(args.assets / drink) for drink in DRINKS}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(results, indent=2) + '\n')
    for drink, data in results.items():
        print(f"{drink}: {'PASS' if data['passed'] else 'FAIL'}; black={data['below_60']}; jumps={data['adjacent_luma_jumps_above_25']}")
    return 0 if all(row['passed'] for row in results.values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
