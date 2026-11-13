import cv2

# Check drops
drops = [
  {'x': 70, 'y': 50, 'r': 8},
  {'x': 120, 'y': 70, 'r': 12},
  {'x': 200, 'y': 40, 'r': 10},
  {'x': 260, 'y': 80, 'r': 7},
  {'x': 50, 'y': 130, 'r': 11},
  {'x': 160, 'y': 110, 'r': 14},
  {'x': 230, 'y': 140, 'r': 9},
  {'x': 90, 'y': 220, 'r': 13},
  {'x': 150, 'y': 260, 'r': 10}, # Collision with NƯỚC LẠNH!
  {'x': 220, 'y': 240, 'r': 15}, # Collision with NƯỚC LẠNH!
  {'x': 270, 'y': 280, 'r': 8},
  {'x': 60, 'y': 320, 'r': 9},
  {'x': 120, 'y': 360, 'r': 14},
  {'x': 180, 'y': 330, 'r': 11},
  {'x': 240, 'y': 370, 'r': 13},
  {'x': 80, 'y': 410, 'r': 10},
  {'x': 150, 'y': 440, 'r': 12},
  {'x': 220, 'y': 420, 'r': 11},
  {'x': 110, 'y': 470, 'r': 8},
  {'x': 190, 'y': 460, 'r': 9},
]

print('--- DROPS COLLIDING WITH NƯỚC LẠNH TEXT ---')
for i, d in enumerate(drops):
    if 230 <= d['y'] <= 290 and 60 <= d['x'] <= 260:
        print(f"Drop {i}: x={d['x']}, y={d['y']}, r={d['r']} collides directly with NƯỚC LẠNH!")

print('\n--- CHECKING DROPS IN ALL SCENES ---')

