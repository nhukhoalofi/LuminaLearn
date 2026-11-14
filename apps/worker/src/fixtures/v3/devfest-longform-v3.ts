import {
  EducationalSceneV3Schema,
  EducationalStoryboardV3Schema,
  type EducationalSceneV3,
  type EducationalStoryboardV3
} from '@luminalearn/scene-schema';
import { devfestAlgebraStoryboardV3 } from './devfest-algebra-v3';
import { devfestDerivativeStoryboardV3 } from './devfest-derivative-v3';
import { devfestGradientDescentStoryboardV3 } from './devfest-gradient-descent-v3';

const cloneScene = (
  scene: EducationalSceneV3,
  patch: Pick<EducationalSceneV3, 'sceneId' | 'durationSeconds'> & Partial<EducationalSceneV3>
): EducationalSceneV3 => EducationalSceneV3Schema.parse({ ...scene, ...patch });

const algebraBase = devfestAlgebraStoryboardV3.scenes;
export const devfestAlgebraLongformStoryboardV3: EducationalStoryboardV3 = EducationalStoryboardV3Schema.parse({
  storyboardId: 'sb_devfest_algebra_longform_v3',
  lessonId: 'lesson_devfest_algebra_longform',
  totalDurationSeconds: 300,
  scenes: [
    cloneScene(algebraBase[0], { sceneId: 'sc_alg_long_hook', durationSeconds: 25 }),
    cloneScene(algebraBase[1], { sceneId: 'sc_alg_long_expansion', durationSeconds: 45 }),
    cloneScene(algebraBase[2], { sceneId: 'sc_alg_long_geometry', durationSeconds: 45 }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_alg_long_numeric_check', sceneType: 'formula_derivation', title: 'Kiểm chứng bằng số cụ thể',
      pedagogicalGoal: 'Thay a bằng 3 và b bằng 2 để kiểm tra đồng thời hai vế của hằng đẳng thức', durationSeconds: 35,
      boundClaimIds: ['claim_identity_square_sum'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Ta kiểm tra với a bằng 3 và b bằng 2. Vế trái là 5 bình phương bằng 25. Vế phải là 9 cộng 12 cộng 4, cũng bằng 25.', subtitleVietnamese: 'Với a = 3, b = 2: cả hai vế đều bằng 25.' },
      visualPayload: { sceneType: 'formula_derivation', headline: 'Hai vế cho cùng một kết quả', formulaTex: '(3+2)^2 = 3^2 + 2\\cdot3\\cdot2 + 2^2 = 25', notes: 'Ví dụ số minh họa cho hằng đẳng thức đã được xác minh.' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_alg_long_misconception', sceneType: 'comparison_table', title: 'Vì sao không thể bỏ số hạng 2ab?',
      pedagogicalGoal: 'Đối chiếu khai triển đầy đủ với lỗi thường gặp là bỏ hai tích chéo', durationSeconds: 35,
      boundClaimIds: ['claim_identity_square_sum'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Lỗi thường gặp là chỉ bình phương từng số hạng. Phép nhân phân phối tạo ra hai tích chéo a b và b a. Hai tích này cộng lại thành hai a b.', subtitleVietnamese: 'Hai tích chéo ab và ba chính là phần thường bị bỏ quên.' },
      visualPayload: { sceneType: 'comparison_table', headline: 'Phần thường bị bỏ quên', formulaTex: '(a+b)^2 = a^2 + \\underbrace{ab+ba}_{2ab} + b^2', notes: 'Không thay đổi công thức đã xác minh; chỉ làm nổi bật nguồn gốc của 2ab.' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_alg_long_guided_practice', sceneType: 'formula_derivation', title: 'Bài tập có hướng dẫn',
      pedagogicalGoal: 'Cho người học tự dự đoán kết quả trước khi hiện lời giải số', durationSeconds: 35,
      boundClaimIds: ['claim_identity_square_sum'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Hãy tạm dừng và tính 7 bình phương bằng cách tách 7 thành 5 cộng 2. Sau đó đối chiếu với ba phần 25, 20 và 4.', subtitleVietnamese: 'Tự kiểm tra: 7² = (5+2)² = 25 + 20 + 4 = 49.' },
      visualPayload: { sceneType: 'formula_derivation', headline: 'Tạm dừng ba giây trước khi xem đáp án', formulaTex: '7^2=(5+2)^2=5^2+2\\cdot5\\cdot2+2^2=49', notes: 'Chiến lược tách số giúp tính nhẩm và củng cố ý nghĩa của tích chéo.' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_alg_long_three_views', sceneType: 'formula_derivation', title: 'Ba cách nhìn cùng một cấu trúc',
      pedagogicalGoal: 'Kết nối phép phân phối, diện tích và ví dụ số thành một mô hình thống nhất', durationSeconds: 40,
      boundClaimIds: ['claim_identity_square_sum'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Đại số cho ta bốn tích. Hình học cho ta bốn miền diện tích. Ví dụ số xác nhận tổng của bốn phần. Ba cách nhìn đều mô tả cùng một cấu trúc.', subtitleVietnamese: 'Đại số, hình học và số học cùng dẫn tới một kết quả.' },
      visualPayload: { sceneType: 'formula_derivation', headline: 'Một định lý, ba biểu diễn', formulaTex: '(a+b)^2=a^2+ab+ab+b^2=a^2+2ab+b^2', notes: 'Mỗi biểu diễn giúp kiểm tra và ghi nhớ biểu diễn còn lại.' }
    }),
    cloneScene(algebraBase[3], { sceneId: 'sc_alg_long_summary', durationSeconds: 40 })
  ]
});

const derivativeBase = devfestDerivativeStoryboardV3.scenes;
const derivativeData = {
  kind: 'scalar_function_1d' as const, functionType: 'polynomial' as const, expression: 'x^2',
  xRange: [-2, 3] as [number, number], yRange: [-1, 9] as [number, number], pointX: 1,
  tangentAtX: 1, secantFromX: 1, secantToX: 2, claimId: 'claim_derivative_tangent', validation: 'formally_verified' as const
};
export const devfestDerivativeLongformStoryboardV3: EducationalStoryboardV3 = EducationalStoryboardV3Schema.parse({
  storyboardId: 'sb_devfest_derivative_longform_v3', lessonId: 'lesson_devfest_derivative_longform', totalDurationSeconds: 300,
  scenes: [
    cloneScene(derivativeBase[0], { sceneId: 'sc_der_long_hook', durationSeconds: 25 }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_der_long_curve', sceneType: 'graph_plot', title: 'Đọc độ dốc trên đường cong', pedagogicalGoal: 'Giới thiệu parabol và điểm P trước khi dựng cát tuyến', durationSeconds: 35,
      boundClaimIds: ['claim_derivative_tangent'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Ta bắt đầu với đồ thị y bằng x bình phương và điểm P có tọa độ một, một. Đường cong không có một độ dốc cố định; độ dốc thay đổi theo vị trí.', subtitleVietnamese: 'Điểm P(1,1) nằm trên parabol, nơi ta muốn đo độ dốc tức thời.' },
      visualPayload: { sceneType: 'graph_plot', headline: 'Đồ thị f(x) = x²', formulaTex: 'P=(1,1)', visualIntent: 'curve_introduction', scientificData: derivativeData, notes: 'Giữ nguyên đồ thị làm trạng thái nền cho các cảnh tiếp theo.' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_der_long_secant', sceneType: 'graph_plot', title: 'Đo độ dốc bằng cát tuyến', pedagogicalGoal: 'Tính hệ số góc qua P và Q khi Q ở x bằng 2', durationSeconds: 40,
      boundClaimIds: ['claim_derivative_tangent'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Chọn Q tại hai, bốn. Hệ số góc cát tuyến bằng bốn trừ một chia hai trừ một, nên bằng ba. Đây mới là độ dốc trung bình trên một khoảng.', subtitleVietnamese: 'Qua P(1,1) và Q(2,4), cát tuyến có hệ số góc bằng 3.' },
      visualPayload: { sceneType: 'graph_plot', headline: 'Độ dốc trung bình trên đoạn PQ', displayMath: { latex: 'm_{PQ}=\\frac{4-1}{2-1}=3', accessibleText: 'Hệ số góc cát tuyến bằng 3', presentation: 'graph_overlay' }, visualIntent: 'secant_measurement', scientificData: derivativeData, notes: 'Cả P và Q đều được tính từ cùng hàm f(x)=x².' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_der_long_limit_motion', sceneType: 'graph_plot', title: 'Cho Q tiến dần về P', pedagogicalGoal: 'Quan sát cát tuyến tiến liên tục tới tiếp tuyến mà không khởi động lại đồ thị', durationSeconds: 50,
      boundClaimIds: ['claim_derivative_tangent'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Bây giờ Q lần lượt đi qua các vị trí một phẩy năm, một phẩy hai, một phẩy không năm và một phẩy không một. Hệ số góc tiến dần từ ba về hai.', subtitleVietnamese: 'Q tiến về P; cát tuyến dần trở thành tiếp tuyến có hệ số góc 2.' },
      visualPayload: { sceneType: 'graph_plot', headline: 'Từ cát tuyến đến tiếp tuyến', displayMath: { latex: '\\lim_{x_Q\\to1}m_{PQ}=2', accessibleText: 'Hệ số góc tiến tới 2', presentation: 'graph_overlay' }, visualIntent: 'limit_transition', scientificData: { ...derivativeData, secantProgression: [2, 1.5, 1.2, 1.05, 1.01] }, notes: 'Các vị trí trung gian chỉ minh họa chuyển động hình học.' }
    }),
    cloneScene(derivativeBase[2], { sceneId: 'sc_der_long_definition', durationSeconds: 45 }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_der_long_numeric', sceneType: 'formula_derivation', title: 'Tính đạo hàm tại x bằng 1', pedagogicalGoal: 'Thay x bằng 1 vào đạo hàm 2x để đối chiếu với tiếp tuyến', durationSeconds: 30,
      boundClaimIds: ['claim_derivative_tangent'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Sau khi tìm được đạo hàm tổng quát hai x, ta thay x bằng một. Kết quả là hai, đúng với hệ số góc tiếp tuyến quan sát trên đồ thị.', subtitleVietnamese: 'Đại số và hình học cùng cho kết quả f phẩy tại 1 bằng 2.' },
      visualPayload: { sceneType: 'formula_derivation', headline: 'Đối chiếu hai cách tính', formulaTex: "f'(1)=2\\cdot1=2", notes: 'Kết quả khớp giới hạn của hệ số góc cát tuyến.' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_der_long_meaning', sceneType: 'concept_intro', title: 'Đạo hàm đo điều gì?', pedagogicalGoal: 'Kết nối hệ số góc tiếp tuyến với tốc độ biến thiên tức thời', durationSeconds: 35,
      boundClaimIds: ['claim_derivative_tangent'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Trong hình học, đạo hàm là hệ số góc tiếp tuyến. Trong chuyển động, đó là vận tốc tức thời. Trong tối ưu hóa, nó cho biết hướng và mức thay đổi của hàm.', subtitleVietnamese: 'Một khái niệm kết nối hình học, chuyển động và tối ưu hóa.' },
      visualPayload: { sceneType: 'concept_intro', centralQuestion: 'Hệ số góc, vận tốc và gradient có điểm gì chung?', keyConcept: 'Tốc độ biến thiên tức thời', accentColor: '#38BDF8', visualStyleId: 'clean_educational_infographic', reducedMotion: false }
    }),
    cloneScene(derivativeBase[3], { sceneId: 'sc_der_long_summary', durationSeconds: 40 })
  ]
});

const gradientBase = devfestGradientDescentStoryboardV3.scenes;
const trace = gradientBase[1].visualPayload.sceneType === 'loss_landscape' ? gradientBase[1].visualPayload : undefined;
if (!trace) throw new Error('devfest_gradient_trace_missing');
export const devfestGradientLongformStoryboardV3: EducationalStoryboardV3 = EducationalStoryboardV3Schema.parse({
  storyboardId: 'sb_devfest_gradient_longform_v3', lessonId: 'lesson_devfest_gradient_longform', totalDurationSeconds: 300,
  scenes: [
    cloneScene(gradientBase[0], { sceneId: 'sc_gd_long_hook', durationSeconds: 25 }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_gd_long_landscape', sceneType: 'concept_intro', title: 'Đọc bản đồ hàm mất mát', pedagogicalGoal: 'Giải thích trục tham số, độ cao loss và điểm cực tiểu trước khi chạy thuật toán', durationSeconds: 35,
      boundClaimIds: ['claim_gd_update_rule'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Trục ngang là tham số w. Độ cao là mất mát. Mục tiêu của thuật toán là tìm vị trí thấp nhất, tại w bằng hai và loss bằng một.', subtitleVietnamese: 'Ta cần đưa tham số từ vùng loss cao về điểm cực tiểu w bằng 2.' },
      visualPayload: { sceneType: 'concept_intro', centralQuestion: 'Làm sao tìm đáy khi chỉ biết độ dốc tại vị trí hiện tại?', keyConcept: 'Hàm mất mát và điểm cực tiểu', accentColor: '#10B981', visualStyleId: 'clean_educational_infographic', reducedMotion: false }
    }),
    cloneScene(gradientBase[2], { sceneId: 'sc_gd_long_update_rule', durationSeconds: 35 }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_gd_long_first_update', sceneType: 'loss_landscape', title: 'Bước đầu tiên làm loss giảm mạnh', pedagogicalGoal: 'Theo dõi chính xác phép cập nhật từ w bằng 4 tới 2 phẩy 4', durationSeconds: 45,
      boundClaimIds: ['claim_gd_update_rule'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Tại w bằng bốn, gradient bằng bốn. Nhân với tốc độ học không phẩy bốn ta được một phẩy sáu. Lấy bốn trừ một phẩy sáu, tham số mới bằng hai phẩy bốn.', subtitleVietnamese: 'Bước 1: w mới bằng 4 trừ 0,4 nhân 4, nên bằng 2,4.' },
      visualPayload: { ...trace, currentParam: 4, steps: trace.steps.slice(0, 2) }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_gd_long_late_updates', sceneType: 'loss_landscape', title: 'Các bước nhỏ dần gần cực tiểu', pedagogicalGoal: 'Giải thích vì sao gradient và độ dài bước cùng nhỏ dần', durationSeconds: 50,
      boundClaimIds: ['claim_gd_update_rule'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Từ hai phẩy bốn, gradient chỉ còn không phẩy tám. Bước tiếp theo tới hai phẩy không tám, rồi hai phẩy không một sáu. Càng gần đáy, gradient càng nhỏ nên bước đi tự thu ngắn.', subtitleVietnamese: 'Gradient nhỏ dần: 0,8 rồi 0,16 rồi 0,032.' },
      visualPayload: { ...trace, currentParam: 2.4, steps: trace.steps.slice(1) }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_gd_long_sign', sceneType: 'formula_derivation', title: 'Vì sao công thức phải có dấu trừ?', pedagogicalGoal: 'Phân biệt hướng gradient tăng nhanh nhất với hướng cập nhật làm giảm loss', durationSeconds: 35,
      boundClaimIds: ['claim_gd_update_rule'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Gradient chỉ theo hướng tăng nhanh nhất. Vì muốn loss giảm, ta phải đi ngược hướng đó. Đây là vai trò của dấu trừ trong quy tắc cập nhật.', subtitleVietnamese: 'Gradient hướng lên dốc; dấu trừ đổi hướng bước đi xuống dốc.' },
      visualPayload: { sceneType: 'formula_derivation', headline: 'Hướng gradient và hướng cập nhật', formulaTex: '\\nabla L(w)\\;\\text{hướng lên},\\qquad -\\eta\\nabla L(w)\\;\\text{hướng xuống}', notes: 'Đây là giải thích hướng đi, không phải một proof record mới.' }
    }),
    EducationalSceneV3Schema.parse({
      sceneId: 'sc_gd_long_limits', sceneType: 'concept_intro', title: 'Điều kiện để học ổn định', pedagogicalGoal: 'Nêu giới hạn của ví dụ lồi và tránh khẳng định hội tụ toàn cục cho mọi bài toán', durationSeconds: 30,
      boundClaimIds: ['claim_gd_update_rule'], rendererTarget: 'remotion_infographic',
      narration: { vietnamese: 'Ví dụ này là một hàm lồi một chiều nên đường đi rất rõ. Với mô hình lớn, landscape có thể phức tạp hơn và tốc độ học cần được lựa chọn cẩn thận.', subtitleVietnamese: 'Ví dụ lồi minh họa nguyên lý; không đại diện cho mọi bài toán tối ưu.' },
      visualPayload: { sceneType: 'concept_intro', centralQuestion: 'Một trace lồi có chứng minh mọi mô hình đều hội tụ không?', keyConcept: 'Giới hạn của ví dụ minh họa', accentColor: '#F59E0B', visualStyleId: 'clean_educational_infographic', reducedMotion: false }
    }),
    cloneScene(gradientBase[3], { sceneId: 'sc_gd_long_summary', durationSeconds: 45 })
  ]
});
