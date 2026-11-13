import cv2

for f in [0, 1, 2, 3, 5, 10, 20]:
    img = cv2.imread(f'outputs/debug_crops/f_{f:03d}.png')
    # Save title crop
    crop = img[220:460, 70:600]
    cv2.imwrite(f'outputs/debug_crops/title_crop_{f:03d}.png', crop)

print('Saved title crops')

