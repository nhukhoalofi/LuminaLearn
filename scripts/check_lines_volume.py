import subprocess, glob, json

files = sorted(glob.glob('outputs/dutai_condensation_lines/line_*.wav'))
for f in files:
    cmd = ['ffmpeg', '-hide_banner', '-i', f, '-af', 'volumedetect', '-vn', '-f', 'null', '-']
    res = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
    mean_v = None
    max_v = None
    for line in res.stderr.split('\n'):
        if 'mean_volume:' in line:
            mean_v = line.split('mean_volume:')[1].strip()
        if 'max_volume:' in line:
            max_v = line.split('max_volume:')[1].strip()
    print(f"{f}: mean={mean_v}, max={max_v}")

