import cv2

ref = cv2.imread('outputs/video3_inspect/frame_005.png')
clone = cv2.imread('outputs/clone3_final_qa/qa_01_hook_can.png')

# ref is 576x1024, clone is 1080x1920
# In ref, can is centered roughly y: 380..650, x: 190..390
ref_can = ref[380:660, 190:390]
cv2.imwrite('outputs/debug_crops/ref_can_crop.png', ref_can)

# In clone, can is centered y: 720..1240, x: 370..710
clone_can = clone[720:1240, 370:710]
cv2.imwrite('outputs/debug_crops/clone_can_crop.png', clone_can)

print('Saved ref_can_crop and clone_can_crop')

