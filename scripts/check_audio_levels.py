import numpy as np
import subprocess, json

# Use ffmpeg to output volume per second or ebur128
cmd = [
    'ffmpeg', '-hide_banner',
    '-i', 'outputs/condensation_exact_clone.mp4',
    '-af', 'ebur128=meter=18',
    '-f', 'null', '-'
]
res = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
lines = res.stderr.split('\n')
for line in lines[-25:]:
    print(line)

