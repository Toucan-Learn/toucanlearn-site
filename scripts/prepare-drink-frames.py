#!/usr/bin/env python3
"""Make 4:3 temporary WebP turns, extending the existing teal edges; no Blender/GPU."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import struct

SITE = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=SITE.parent / 'outputs/drinks-blender/renders')
parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
args = parser.parse_args()
if not args.ffmpeg:
    parser.error('FFmpeg with libwebp is required; pass --ffmpeg /path/to/ffmpeg. No downloads are performed.')

for drink in ['skids', 'fizzy', 'ground-pinch']:
    sources = sorted((args.source / drink).glob('frame_*.png'))
    if len(sources) < 2 or [p.name for p in sources] != [f'frame_{i:04d}.png' for i in range(1, len(sources) + 1)]:
        raise SystemExit(f'{drink}: expected a complete, contiguous PNG turn from frame_0001.png')
    destination = SITE / 'assets/projects/drinks' / drink
    manifest = destination / 'manifest.json'
    if manifest.exists() and not json.loads(manifest.read_text()).get('temporary', False):
        raise SystemExit(f'{drink}: refusing to overwrite production frames')
    destination.mkdir(parents=True, exist_ok=True)
    with sources[0].open('rb') as source:
        header = source.read(24)
    width, height = struct.unpack('>II', header[16:24])
    # Keep the drink at its existing height/centre. Extend the outermost teal
    # column per row, so the gradient meets the source without a hard seam.
    scaled_width = round(width * 900 / height)
    filters = [f'scale={scaled_width}:900']
    if scaled_width < 1200:
        left = (1200 - scaled_width) // 2
        right = 1200 - scaled_width - left
        filters += [f'pad=1200:900:{left}:0:color=0x1f7a75', f'fillborders=left={left}:right={right}:mode=smear']
    else:
        filters += ['crop=1200:900:(iw-ow)/2:0']
    subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-start_number', '1',
                    '-i', str(args.source / drink / 'frame_%04d.png'), '-vf', ','.join(filters),
                    '-frames:v', str(len(sources)), '-c:v', 'libwebp', '-quality', '82',
                    '-start_number', '0', str(destination / '%03d.webp')], check=True)
    width, height = 1200, 900
    shutil.copyfile(destination / '000.webp', destination / 'poster.webp')
    manifest.write_text(json.dumps({'frameCount': len(sources), 'width': width, 'height': height, 'dragDirection': -1, 'temporary': True}, indent=2) + '\n')
    print(f'{drink}: {len(sources)} temporary frames, {width}×{height}, front-facing poster')
