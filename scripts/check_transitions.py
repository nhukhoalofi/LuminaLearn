import cv2

cap = cv2.VideoCapture('outputs/condensation_exact_clone.mp4')
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

# Check every 10 frames across entire video
suspicious = []
for f in range(0, total, 10):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f)
    ret, frame = cap.read()
    if not ret: break
    
    # Check top text area y: 220..480
    # Check bottom subtitle area y: 1550..1800
    # Let's save frames around transitions
    if f in [130, 135, 140, 385, 390, 395, 565, 570, 575, 805, 810, 815, 1015, 1020, 1025, 1225, 1230, 1235, 1555, 1560, 1565]:
        cv2.imwrite(f'outputs/debug_crops/transition_{f:04d}.png', frame)

print(f"Total checked: {total} frames")

