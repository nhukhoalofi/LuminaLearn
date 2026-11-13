import json

with open('outputs/dutai_phone_audio/scenes_meta.json', encoding='utf-8') as f:
    meta = json.load(f)

scene_timings = [
    {'id': 'scene_01_intro', 'startSec': 0.2},
    {'id': 'scene_02_hook', 'startSec': 3.4},
    {'id': 'scene_03_chain', 'startSec': 10.0},
    {'id': 'scene_04_step1_mic', 'startSec': 18.0},
    {'id': 'scene_05_step2_dsp', 'startSec': 25.5},
    {'id': 'scene_06_step3_tx_ant', 'startSec': 33.2},
    {'id': 'scene_07_step4_network', 'startSec': 43.0},
    {'id': 'scene_08_step5_rx_ant', 'startSec': 51.0},
    {'id': 'scene_09_step6_speaker', 'startSec': 61.0},
    {'id': 'scene_10_duplex', 'startSec': 70.5},
    {'id': 'scene_11_outro', 'startSec': 78.5}
]

print("=== TIMELINE ANALYSIS ===")
for i, t in enumerate(scene_timings):
    m = next((x for x in meta if x['id'] == t['id']), None)
    dur = m['durationSec'] if m else 0
    end = t['startSec'] + dur
    nxt = scene_timings[i+1] if i + 1 < len(scene_timings) else None
    if nxt:
        gap = nxt['startSec'] - end
        gap_str = f"{gap:+.2f}s"
        status = "OK" if gap >= 0 else "OVERLAP!"
    else:
        gap_str = "END"
        status = "OK"
    print(f"{t['id']:22}: start={t['startSec']:5.2f}s, dur={dur:5.2f}s, end={end:5.2f}s -> gap={gap_str:>7} [{status}]")

