import os
from PIL import Image, ImageDraw, ImageFont

root = os.getcwd()
ref_dir = os.path.join(root, 'outputs/video4_inspect/frames')
qa_dir = os.path.join(root, 'outputs/seasons_final_qa')
out_dir = os.path.join(root, 'outputs/seasons_side_by_side')
os.makedirs(out_dir, exist_ok=True)

pairs = [
    ('frame_002.png', 'scene1_hook_day15.png', '01_Hook_Day15'),
    ('frame_005.png', 'scene2_question_reveal.png', '02_Question_Reveal'),
    ('frame_012.png', 'scene3_misconception_debunk.png', '03_Misconception_Debunk'),
    ('frame_021.png', 'scene4_axial_tilt_orbit.png', '04_Axial_Tilt_Orbit'),
    ('frame_032.png', 'scene5_angle_flux_concentrated.png', '05_Angle_Flux_Concentration'),
    ('frame_043.png', 'scene6_hanoi_day_night.png', '06_Hanoi_Day_Night'),
    ('frame_050.png', 'scene7_summary_recap.png', '07_Summary_Recap'),
    ('frame_056.png', 'scene8_interactive_quiz.png', '08_Interactive_Quiz')
]

print("=== Generating Side-by-Side QA Verifications for Earth Seasons Video ===")

for ref_name, qa_name, label in pairs:
    ref_path = os.path.join(ref_dir, ref_name)
    qa_path = os.path.join(qa_dir, qa_name)
    
    if not os.path.exists(ref_path) or not os.path.exists(qa_path):
        print(f"Skipping {label}: missing files")
        continue

    ref_img = Image.open(ref_path).convert('RGB')
    qa_img = Image.open(qa_path).convert('RGB')

    # Target height 960 for comparison, maintaining 9:16 aspect ratio (540x960)
    target_h = 960
    target_w = 540

    ref_resized = ref_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    qa_resized = qa_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # Combined image: width = 540 + 20 (gap) + 540 = 1100, height = 960 + 60 (header banner)
    combo_w = target_w * 2 + 30
    combo_h = target_h + 70
    combo = Image.new('RGB', (combo_w, combo_h), color=(15, 23, 42))
    draw = ImageDraw.Draw(combo)

    # Paste images
    combo.paste(ref_resized, (10, 60))
    combo.paste(qa_resized, (target_w + 20, 60))

    # Banner text
    draw.text((20, 15), f"BẢN GỐC (Video 4): {label}", fill=(148, 163, 184))
    draw.text((target_w + 30, 15), f"LUMINA CLONE (Remotion + DUTAI TTS): {label}", fill=(56, 189, 248))

    out_path = os.path.join(out_dir, f"{label}_comparison.png")
    combo.save(out_path, quality=92)
    print(f"  ✓ Saved comparison: {out_path}")

print("\n✓ All side-by-side verification images created successfully in outputs/seasons_side_by_side/!")
