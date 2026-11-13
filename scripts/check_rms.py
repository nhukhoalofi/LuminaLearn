import subprocess

cmd = ['ffmpeg', '-hide_banner', '-i', 'outputs/condensation_final_audio_with_bgm.wav', '-af', 'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=outputs/audio_rms.txt', '-f', 'null', '-']
subprocess.run(cmd, stderr=subprocess.PIPE)

# Read audio_rms.txt
with open('outputs/audio_rms.txt', 'r') as f:
    lines = f.readlines()

print(f"Total entries: {len(lines)}")
# Sample every 500 lines
for i in range(0, len(lines), max(1, len(lines)//15)):
    print(lines[i].strip())

