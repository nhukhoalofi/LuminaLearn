# Hướng dẫn trình diễn DevFest 2026 — LuminaLearn V3

## Thông điệp trung thực

LuminaLearn tách ba lớp kiểm soát:

- SymPy kiểm tra hình thức các biểu thức được hỗ trợ.
- Bộ kiểm tra số xác nhận trace Gradient Descent cụ thể của bài học; kết quả này không phải chứng minh SymPy.
- Giáo viên duyệt nội dung và phiên bản trước khi render; phê duyệt không tự biến mọi công thức thành “SymPy Verified”.

Không dùng cụm từ “zero hallucination”, “mọi claim đều có proof”, “toàn bộ sản phẩm production-ready”, hoặc “mọi topic đều render-ready”. Bayes hiện chỉ `planning_only`.

## Thứ tự video

1. `artifacts/quality-sprint-b/devfest-derivative-tangent.mp4` — 52 giây.
2. `artifacts/quality-sprint-b/devfest-algebra-identity.mp4` — 48 giây.
3. `artifacts/quality-sprint-b/devfest-gradient-descent.mp4` — 52 giây.

Ba file là bản dựng cục bộ, H.264 720×1280 @ 24fps. Chúng có phụ đề tiếng Việt ghi trực tiếp lên hình nhưng **không có audio stream**; luôn giới thiệu là `SUBTITLE_ONLY`, không phải Gemini TTS.

## Nội dung nên trình bày

### Đạo hàm

Nêu rõ fixture dùng `f(x)=x²`, `f'(x)=2x`, `f'(1)=2`. Điểm Q luôn nằm trên cùng parabol và tiến về P=(1,1); cát tuyến chuyển dần thành tiếp tuyến trong thời lượng cảnh.

### Hằng đẳng thức

Trình bày bốn bước tương đương của `(a+b)²`, sau đó đối chiếu hình vuông 5×5 với bốn miền có diện tích 9, 6, 6 và 4. Nhãn trung lập “Biến đổi đại số từng bước” là chủ ý an toàn nếu không có binding proof chính xác cho từng bước.

### Gradient Descent

Đây là kiểm định số có ràng buộc, không phải chứng minh SymPy. Trace hiện tại là `L(w)=(w-2)²+1`, `η=0.4`, với `w: 4 → 2.4 → 2.08 → 2.016`. Chỉ phát biểu hội tụ trong ví dụ hàm lồi và learning rate phù hợp; không suy rộng thành bảo đảm hội tụ toàn cục.

## Teacher Studio

Có thể mở `http://localhost:3000` để minh họa draft, storyboard và bước giáo viên phê duyệt. Không nói rằng thao tác chọn mock preset tự tái tạo đúng ba MP4 đã dựng sẵn. Các MP4 là composition fixtures riêng, có ID:

- `DevFestDerivativeTangentV3`
- `DevFestAlgebraIdentityV3`
- `DevFestGradientDescentV3`

Preset 600 giây không được quảng bá trong Teacher Studio của release này. Planner hiện trả lỗi capacity rõ ràng thay vì chèn cảnh filler không có giá trị giáo dục.

## Quy trình sân khấu và dự phòng

Không render 1.200 frame trực tiếp trên sân khấu. Mở ba MP4 cục bộ bằng VLC/Windows Media Player và giữ sẵn các keyframe trong `artifacts/quality-sprint-b/` để dự phòng. Không cần mạng để phát các file này.

Nếu trình diễn luồng Live Gemini, phải nói rõ đó là luồng riêng, phụ thuộc mạng/quota và cần đồng ý gọi API. Không chuyển âm thầm sang Mock khi Live lỗi. Bản vá B.4.1 và quá trình QA này không gọi Gemini hoặc Gemini TTS.

## Trạng thái phát hành

Ba video cục bộ đã được FFprobe, băm SHA-256 và kiểm tra keyframe. Tuy nhiên candidate CI chưa chạy cho bản vá chưa commit; run baseline `42962460898` đang đỏ. Vì vậy thông điệp đúng là: **CONDITIONAL_GO cho demo offline ba video; chưa GO cho production release**.
