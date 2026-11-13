import { EducationalStoryboardV3Schema } from '@luminalearn/scene-schema';

const optics = {
  airRefractiveIndex: 1,
  waterRefractiveIndices: { red: 1.331, violet: 1.344 },
  primaryRainbowAnglesDeg: { red: 42.37, violet: 40.51 },
  accentColor: '#38BDF8'
} as const;

const beats = [
  ['hook', 'Một giọt mưa có thể tách ánh sáng?', 'Theo dấu một tia sáng', 'push_in', false, 5, 'Ngay sau cơn mưa, hàng triệu giọt nước còn lơ lửng. Chỉ một tia sáng Mặt Trời đi qua đúng đường đã đủ tạo nên một mảnh cầu vồng.'],
  ['white_light_spectrum', 'Ánh sáng trắng chứa một phổ liên tục', 'Mỗi bước sóng bị bẻ cong khác nhau', 'track_ray', false, 9, 'Ánh sáng trắng không phải đúng bảy màu rời rạc. Nó là một phổ liên tục; trong nước, mỗi bước sóng có chiết suất hơi khác nhau.'],
  ['entry_refraction', 'Lần 1: khúc xạ khi đi vào', 'Tia đổi hướng tại mặt giọt nước', 'push_in', true, 11, 'Khi đi từ không khí vào nước, tia sáng chậm lại và khúc xạ về phía pháp tuyến. Tia tím bị bẻ cong mạnh hơn tia đỏ.'],
  ['internal_reflection', 'Lần 2: phản xạ ở mặt sau', 'Một lần phản xạ tạo cầu vồng chính', 'orbit_drop', true, 10, 'Các tia chạm mặt sau của giọt và phản xạ trở lại. Với cầu vồng chính, đường đi quan trọng có đúng một lần phản xạ bên trong.'],
  ['exit_angles', 'Lần 3: khúc xạ khi đi ra', 'Đỏ khoảng 42,37° · tím khoảng 40,51°', 'track_ray', true, 11, 'Khi rời giọt nước, tia khúc xạ lần nữa. Mô hình cho góc cực đại khoảng bốn mươi hai phẩy ba bảy độ với đỏ và bốn mươi phẩy năm mốt độ với tím.'],
  ['observer_arc', 'Vì sao ta thấy một cung tròn?', 'Mặt Trời sau lưng · mưa phía trước', 'pull_out', false, 14, 'Mắt chỉ nhận những tia đến từ các giọt nằm đúng trên một hình nón quanh hướng đối Mặt Trời. Mặt đất che phần dưới, nên ta thường thấy một cung: đỏ ở ngoài, tím ở trong.']
] as const;

export const rainbowPhysicsStoryboardV3 = EducationalStoryboardV3Schema.parse({
  storyboardId: 'sb_rainbow_physics_demo',
  lessonId: 'lesson_rainbow_physics_demo',
  totalDurationSeconds: 60,
  chapters: beats.map((beat, index) => ({ title: beat[1], startFrame: beats.slice(0, index).reduce((sum, item) => sum + item[5] * 30, 0) })),
  scenes: beats.map(([stage, headline, focusLabel, cameraMove, showNormals, durationSeconds, narration], index) => ({
    sceneId: `sc_rainbow_${index + 1}`,
    sceneType: 'physics_optics',
    title: headline,
    pedagogicalGoal: focusLabel,
    durationSeconds,
    boundClaimIds: [index < 2 ? 'claim_rainbow_dispersion' : index === 3 ? 'claim_rainbow_internal_reflection' : 'claim_rainbow_angles'],
    rendererTarget: 'remotion_infographic',
    narration: { vietnamese: narration, subtitleVietnamese: narration },
    visualPayload: { sceneType: 'physics_optics', stage, headline, focusLabel, ...optics, showNormals, cameraMove }
  }))
});
