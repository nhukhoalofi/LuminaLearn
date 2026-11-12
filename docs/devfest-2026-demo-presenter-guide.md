# Hướng dẫn trình diễn DevFest 2026 — LuminaLearn V3

## Thông điệp trung thực

LuminaLearn tách riêng ba lớp bảo đảm:

- SymPy kiểm tra hình thức các biểu thức được hỗ trợ và có binding chính xác.
- Bộ kiểm tra số xác nhận trace Gradient Descent cụ thể; kết quả này không phải proof SymPy.
- Giáo viên duyệt nội dung và phiên bản trước khi render; phê duyệt không tự biến mọi công thức thành “SymPy Verified”.

Không dùng các tuyên bố “zero hallucination”, “mọi claim đều có proof”, “toàn bộ sản phẩm production-ready”, hoặc “mọi topic đều render-ready”. Bayes vẫn là `planning_only`.

## Thứ tự video đề xuất

1. `artifacts/quality-sprint-b/devfest-derivative-tangent.mp4` — 52 giây.
2. `artifacts/quality-sprint-b/devfest-algebra-identity.mp4` — 48 giây.
3. `artifacts/quality-sprint-b/devfest-gradient-descent.mp4` — 52 giây.

Ba file là fixture dựng cục bộ, H.264 720×1280 @ 24fps. Phụ đề tiếng Việt được ghi trực tiếp lên hình; **không có audio stream**. Luôn giới thiệu là `SUBTITLE_ONLY`, không phải Gemini TTS.

## Điểm nói chính

### Đạo hàm

Fixture dùng `f(x)=x²`, `P=(1,1)`, `f'(x)=2x`, `f'(1)=2`. Q luôn ở trên parabol và tiến về P; cát tuyến chuyển thành tiếp tuyến trong cảnh khoa học 24 giây.

### Hằng đẳng thức

Trình bày bốn bước tương đương của `(a+b)²`, rồi đối chiếu hình vuông 5×5 với bốn miền diện tích 9, 6, 6 và 4. Không gọi phần tổng kết là proof SymPy; nhãn an toàn là “Kết quả trọng tâm”.

### Gradient Descent

Đây là kiểm định số có ràng buộc, không phải chứng minh SymPy. Trace là `L(w)=(w-2)²+1`, `η=0.4`, `w: 4 → 2.4 → 2.08 → 2.016`. Chỉ mô tả kết quả của ví dụ hàm lồi và learning rate cụ thể; không hứa hội tụ toàn cục.

## Teacher Studio

Có thể mở `http://localhost:3000` để minh họa draft, storyboard, review và phê duyệt giáo viên. Preset chỉ điền tham số; nó không tự chọn hoặc tái tạo đúng ba MP4 fixture. Offline smoke Derivative đã đi qua draft → scientific validation → semantic review → approval → render authorization, và xác nhận chỉnh sửa sau approval làm mất quyền render của artifact cũ.

Không quảng bá preset 600 giây. Bản phát hành hỗ trợ 35, 60, 180 và 300 giây; yêu cầu 600 giây phải trả lỗi capacity có cấu trúc, không chèn filler.

## Vận hành trên sân khấu

- Phát ba MP4 cục bộ; không render trực tiếp trên sân khấu.
- Kiểm tra hash bằng `docs/devfest-2026-media.sha256` sau khi sao chép sang máy trình chiếu.
- Giữ ba contact sheet trong `artifacts/quality-sprint-b/` làm phương án dự phòng.
- Nếu minh họa Live Gemini, nói rõ đó là luồng riêng phụ thuộc mạng/quota và cần cho phép API. Không âm thầm chuyển Live sang Mock.

## Trạng thái phát hành

Ba video local đã được render lại, FFprobe, băm SHA-256 và kiểm tra contact sheet sau khi bỏ nhãn SymPy không có exact binding. Tuy nhiên CI run `42969978962` của baseline `97fdaef…` thất bại tại `Run Multi-Agent Supervisor tests`, còn patch local chưa được commit/push để chạy candidate CI mới.

Thông điệp đúng: **CONDITIONAL_GO cho showcase offline ba video; NO_GO cho production release cho tới khi candidate CI mới pass**.
