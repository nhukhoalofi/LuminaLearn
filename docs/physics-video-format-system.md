# Physics Video Format System V3

## Mục tiêu

LuminaLearn không dựng hoạt hình trực tiếp từ văn bản tự do. Mỗi bài Vật lý đi qua chuỗi có kiểm soát:

`Topic → Capability → Claims → Typed storyboard → Scientific review → Teacher approval → Render`

Thiết kế này giữ phần giải thích, dữ liệu mô phỏng và animation tách biệt. Gemini có thể đề xuất nội dung, nhưng không được tự nâng một chủ đề thành `render_ready` và không thay thế kiểm định khoa học hoặc phê duyệt của giáo viên.

## Ngữ pháp kể chuyện 60 giây

Ba format demo dùng cùng sáu nhịp sư phạm, nhưng không dùng cùng một cảnh:

1. `hook` — câu hỏi hoặc nghịch lý trong ba giây đầu.
2. `system_model` — giới thiệu hệ và các thành phần cần quan sát.
3. `mechanism_a` — cơ chế thứ nhất.
4. `mechanism_b` — cơ chế thứ hai hoặc trạng thái chuyển tiếp.
5. `evidence` — dữ liệu, quan sát hoặc điều kiện kiểm chứng.
6. `takeaway` — kết luận ngắn, đúng phạm vi của bằng chứng.

## Các format typed

| Family | Dùng cho | Payload mô phỏng | Trạng thái |
| --- | --- | --- | --- |
| `physics_optics` | Cầu vồng, tán sắc trong giọt nước | tia sáng, môi trường, góc, bước sóng | Render-ready cho preset cầu vồng |
| `process_chain` | Điện thoại, truyền và biến đổi tín hiệu | các nút, bước đang hoạt động, vật mang tín hiệu | Render-ready cho preset nghe gọi |
| `particle_state` | Ngưng tụ, điểm sương | số hạt, pha, nhiệt độ bề mặt và điểm sương | Render-ready cho preset ngưng tụ |
| `wave_propagation` | Viễn thông và sóng âm | biên độ, tần số, bước sóng, vận tốc | Render-ready trong các capability đã đăng ký |
| `force_motion` | Newton, ném xiên và con lắc | vật, vector lực, động học và giới hạn mô hình | Render-ready trong các capability đã đăng ký |
| `energy_transfer` | Con lắc và bảo toàn cơ năng | tỉ lệ động năng/thế năng, tổng năng lượng | Render-ready trong các capability đã đăng ký |

## Capability hiện đã render-ready

| Chủ đề | Format chính | Bất biến được kiểm tra |
| --- | --- | --- |
| Cầu vồng | `physics_optics` | chiết suất, thứ tự tán sắc và góc cầu vồng Descartes |
| Nghe gọi điện thoại | `process_chain` + `wave_propagation` | nút tín hiệu hợp lệ; không đánh đồng sóng âm với sóng điện từ |
| Ngưng tụ trên lon lạnh | `particle_state` | nhiệt độ bề mặt không vượt điểm sương khi gắn nhãn ngưng tụ |
| Sóng âm | `wave_propagation` | `v = fλ` khi có dữ liệu vật lý |
| Định luật II Newton | `force_motion` | `F = ma` và đủ bộ khối lượng–gia tốc–hợp lực |
| Ném xiên | `force_motion` | đủ vận tốc đầu, góc phóng và gia tốc trọng trường; mô hình bỏ qua lực cản |
| Con lắc đơn | `force_motion` + `energy_transfer` | `T = 2π√(L/g)` trong giới hạn góc nhỏ và tổng cơ năng bằng một |
| Bảo toàn cơ năng | `energy_transfer` | động năng cộng thế năng bằng toàn bộ cơ năng lý tưởng |

Mỗi payload được Zod kiểm tra. Ví dụ, cảnh ngưng tụ bị từ chối nếu nhiệt độ bề mặt cao hơn điểm sương; chuỗi tín hiệu bị từ chối nếu bước đang hoạt động không tồn tại.

## Quy tắc an toàn năng lực

- Tám preset Vật lý trong bảng capability được gắn `render_ready`; mỗi preset có giới hạn mô hình riêng.
- Chủ đề Vật lý chung như Lorentz, cảm ứng điện từ, thấu kính nhiều phần tử hoặc chất lưu vẫn ở `planning_only` cho đến khi có hợp đồng mô phỏng, nguồn và kiểm thử riêng.
- Một payload typed hợp lệ không đồng nghĩa với nội dung khoa học đã được chứng minh.
- Mọi storyboard vẫn phải qua kiểm định yêu cầu của capability và giáo viên duyệt trước khi tạo artifact render.

## Tích hợp Teacher Studio

Hai preset nghe gọi và ngưng tụ tạo storyboard sáu cảnh, 60 giây, 1080×1920, 30 FPS. Renderer dùng `CinematicPhysicsExplainerScene` và chọn canvas theo `simulation.kind`; không rơi về video cầu vồng khi gặp chủ đề khác.

Preview QA cục bộ:

- `PhysicsProcessFamilyPreviewV3`
- `PhysicsParticleFamilyPreviewV3`
- `outputs/physics-format-qa/process.png`
- `outputs/physics-format-qa/particle.png`
- `outputs/physics-format-qa/contact-sheet.png`
- `outputs/physics-format-qa/sound.png`
- `outputs/physics-format-qa/projectile.png`
- `outputs/physics-format-qa/pendulum.png`
- `outputs/physics-format-qa/energy.png`
- `outputs/physics-format-qa/expanded-contact-sheet.png`

Các preview chỉ chứng minh hợp đồng hình ảnh và khả năng render. Chúng không thay thế video MP4 cuối, kiểm tra audio/subtitle hoặc teacher approval.

## Hướng mở rộng đúng cách

Để thêm một hiện tượng Vật lý mới:

1. Đăng ký capability với giới hạn rõ ràng.
2. Tạo claim và nguồn hỗ trợ cho chính hiện tượng đó.
3. Chọn hoặc mở rộng simulation contract; không đưa tọa độ hoạt hình tùy ý từ LLM.
4. Viết fixture và kiểm thử bất biến khoa học.
5. Render still/contact sheet, sau đó mới render MP4 và kiểm tra audio, phụ đề, khoảng lặng.
6. Chỉ nâng thành `render_ready` khi toàn bộ gate tương ứng đã có bằng chứng.

## Vòng lặp generate–critic–revise

`PhysicsStoryboardQualityLoop` cung cấp một critic deterministic, tối đa ba lượt và không tự gọi API ngoài. Mỗi bản nháp Vật lý được kiểm tra:

- đủ sáu nhịp hook, system model, hai cơ chế, evidence và takeaway;
- tối thiểu ba trạng thái hình ảnh và ba chuyển động camera cho bài nhiều cảnh;
- không lặp tiêu đề;
- tốc độ lời giảng khuyến nghị không vượt 3,5 từ/giây và chặn khi vượt 4,2 từ/giây;
- mọi scene chỉ tham chiếu claim tồn tại;
- capability `render_ready` không được phát hành với storyboard quá nông.

Callback `revise` chỉ sửa bản nháp chưa duyệt. Artifact đã được giáo viên phê duyệt vẫn bất biến và không bị vòng lặp tự động ghi đè. Live Gemini vẫn cần consent và request budget riêng; critic không tự phát sinh cuộc gọi trả phí.

## Lớp hình ảnh giàu ngữ cảnh

Mỗi scene hiện có thêm ba pictogram theo tiến trình của family, bên cạnh mô phỏng chính. Scene takeaway có thể dùng mascot `apps/worker/public/visual-assets/lumina-science-guide.png`. Mascot được tạo bằng công cụ image generation dưới dạng PNG trong suốt, chỉ đóng vai trò dẫn chuyện; nó không được dùng làm bằng chứng khoa học. Đồ thị, vector lực, quỹ đạo và dữ liệu đo vẫn là hình code-native được schema kiểm tra.

