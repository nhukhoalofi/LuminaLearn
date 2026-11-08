# LuminaLearn — Mentor Presentation & Final Demo Playbook

**Version:** V2.4.6  
**Audience:** DevFest 2026 Hackathon Technical Mentors  
**Target Time:** 5:00 minutes total (Team of 3 presenters)

---

## 1. Five-Minute Presentation Script (Team of 3)

### Person 1 — Problem, Product Vision & Input Workflow (0:00 – 1:30)

> "Xin chào quý ban giám khảo và các mentor. Tôi phụ trách phần bài toán, tầm nhìn sản phẩm và quy trình nhập liệu của **LuminaLearn**.
>
> **1. Vấn đề thực tế:**  
> Hiện nay, khi giáo viên sử dụng các công cụ AI tạo video giáo dục (Text-to-Video), họ gặp phải hai 'nỗi sợ hãi' lớn nhất:
> 1. **Ảo giác toán học (Mathematical Hallucination):** AI thường tự vẽ đồ thị sai, viết sai công thức đạo hàm hoặc tích phân, gây nguy hại cho học sinh.
> 2. **Thiếu khả năng kiểm soát (Black-Box Generation):** Video xuất ra mà giáo viên không có cách nào can thiệp, chỉnh sửa hay phê duyệt từng bước sư phạm.
>
> **2. Giải pháp LuminaLearn:**  
> LuminaLearn là **Hệ thống AI tạo video bài giảng Toán học có kiểm chứng hình thức (Formally Verified STEM Video Studio)**. Chúng tôi trao quyền kiểm soát tuyệt đối cho giáo viên và đảm bảo không một khung hình video nào được kết xuất nếu toán học chưa được chứng minh đúng.
>
> **3. Luồng nhập liệu linh hoạt (Hai chế độ):**  
> - **Chế độ 1 — Nhập chủ đề trực tiếp (Topic Prompt):** Ví dụ: *'Tổng Riemann và trực giác tích phân của x^2 trên đoạn [0, 1]'*.
> - **Chế độ 2 — Tài liệu nguồn (Document-to-Video):** Hỗ trợ nạp file `.md`, `.txt`, `.docx` hoặc `.pdf`. Hệ thống trích xuất văn bản an toàn, bẻ nhỏ thành các chunk và gắn nhãn nghiêm ngặt để đối chiếu nguồn."

---

### Person 2 — Gemini Agents, Source Grounding, SymPy & Human Approval (1:30 – 3:15)

> "Tiếp nối phần nhập liệu, tôi sẽ trình bày về kiến trúc trí tuệ nhân tạo, đối chiếu tài liệu và cổng kiểm định toán học độc lập.
>
> **1. Gemini Multi-Agent & True Document Grounding:**  
> LuminaLearn sử dụng hệ thống Multi-Agent chuyên biệt:
> - **DocumentAnalyst:** Quét tài liệu nguồn, tìm kiếm trích dẫn nguyên văn (`exactQuote`). Quan trọng nhất: **Hệ thống phân tách rạch ròi 4 trạng thái**: trích dẫn có tồn tại hay không (`quoteExists`), có trích xuất được mệnh đề hay không (`claimExtracted`), tài liệu có thực sự hỗ trợ hay không (`supportStatus`), và toán học có đúng hay không. Hệ thống tuyệt đối không tự bịa ra công thức nếu tài liệu không đề cập!
> - **CurriculumPlanner:** Lập kế hoạch sư phạm theo chuẩn cấu trúc `LessonPlanV2` và `MathVisualizationSpecV2`.
>
> **2. Cổng kiểm định toán học độc lập (SymPy Formal Verification Gate):**  
> Đây là trái tim của LuminaLearn:
> - Chúng tôi **không bao giờ cho AI tự chấm điểm chính mình**.
> - Mọi mệnh đề toán học (`mathematicalClaims`) đều được chuyển xuống **SymPy Python Engine** độc lập để chứng minh đại số hình thức.
> - Nếu mệnh đề sai (ví dụ tài liệu viết 'đạo hàm của $x^2$ là $3x$' hoặc tích phân bằng $1/2$), SymPy lập tức từ chối (`fail-closed`), hiển thị thông báo lỗi bằng tiếng Việt rõ ràng và khóa nút duyệt video!
>
> **3. Phê duyệt của giáo viên & Tính bất biến (Immutable Approved Artifact):**  
> - Giáo viên có thể trực tiếp sửa tiêu đề, công thức, lời dẫn và phụ đề ngay trên giao diện Web.
> - Mỗi lần sửa, phiên bản (`version`) tự động tăng lên; hệ thống kiểm tra xung đột phiên bản (HTTP 409) để chống ghi đè đồng thời.
> - Khi giáo viên nhấn **'Duyệt bản thảo'**, hệ thống đóng băng dữ liệu thành `ApprovedRenderArtifactV2` với mã băm SHA-256 (`contentHash` và `verificationBindingHash`). Nếu bất kỳ ai cố tình sửa đổi file sau khi duyệt, engine kết xuất sẽ từ chối render ngay lập tức (`artifact_tampered`)."

---

### Person 3 — Manim + Remotion Engine, Media QA & Demo Thực Tế (3:15 – 5:00)

> "Cuối cùng, tôi xin chứng minh năng lực kết xuất đồ họa toán học, kiến trúc âm thanh và bằng chứng thực nghiệm của LuminaLearn.
>
> **1. Động cơ kết xuất lai (Hybrid Manim + Remotion Engine):**  
> - **Manim (Mathematical Animation Engine):** Chịu trách nhiệm vẽ các đối tượng hình học phức tạp với độ chính xác toán học tuyệt đối: parabol $f(x)=x^2$, các cột hình chữ nhật tổng Riemann chia $n=4, 8, 16$, và diện tích tích phân dưới đường cong.
> - **Remotion (React Video Engine):** Ghép nối khung hình video dọc chuẩn TikTok/Shorts (720×1280 @ 24 FPS), quản lý các hiệu ứng chuyển cảnh điện ảnh sư phạm (Video Shotcraft: `ConceptTitleReveal`, `StepFormulaReveal`) và phụ đề đồng bộ chính xác đến từng mili-giây.
>
> **2. Kiến trúc âm thanh & Gemini TTS:**  
> - LuminaLearn hỗ trợ đa kênh âm thanh: từ chế độ không lời thoại (`narrationMode = 'none'`), âm thanh tự thu của giáo viên (`provided_audio`), đến **Gemini TTS** tiếng Việt (giọng `Kore`).
> - Chúng tôi thực hiện **kiểm định âm thanh trung thực (Audible Speech Verification)**: dùng bộ lọc FFmpeg `volumedetect` để phân biệt rãnh âm thanh thực sự có tiếng nói với rãnh âm thanh tĩnh (`silent_fixture` -91 dB).
>
> **3. Bằng chứng kiểm thử thực tế (End-to-End Real Evidence):**  
> - Toàn bộ hệ thống đã vượt qua bài kiểm thử trình duyệt thực tế **Playwright Chromium E2E** (`test:e2e:real`).
> - Video thực tế `outputs/job-20261108055404-a35f979f/final.mp4` đã được kết xuất hoàn chỉnh: độ phân giải 720×1280, 24 FPS, dài đúng 31.625 giây (759 frames), không có khung hình đen, không bị đè chữ lên công thức, và phụ đề tiếng Việt `.srt` hoạt động chuẩn xác.
> - Toàn bộ quy trình này có thể chạy **hoàn toàn offline 100%** mà không phụ thuộc vào kết nối mạng hay hạn mức API.
>
> Xin cảm ơn các mentor, chúng tôi sẵn sàng trả lời các câu hỏi kỹ thuật!"

---

## 2. Kịch Bản Demo Trực Tiếp & Phương Án Dự Phòng (Offline Fallback Playbook)

### Kịch Bản Chính: Trình Diễn Web UI Trực Tiếp (2 Phút)

1. **Khởi động server cục bộ:**
   ```powershell
   cd D:\Hackathon\LuminaLearn
   pnpm --filter @luminalearn/web dev
   ```
2. **Mở trình duyệt:** Truy cập `http://localhost:3000`.
3. **Thao tác 1: Tạo bản thảo từ chủ đề:**
   - Nhập: *"Tổng Riemann và trực giác tích phân của x bình phương trên đoạn từ 0 đến 1"*.
   - Chọn phong cách: *"Educational Infographic"*.
   - Nhấn **"Xem trước bản thảo bài học"**.
   - **Chỉ ra cho mentor thấy:** Huy hiệu **"SymPy Verified"** màu xanh lá, bảng 2 mệnh đề toán học đã được SymPy xác minh giá trị $1/3$, cùng các phân cảnh kịch bản storyboard.
4. **Thao tác 2: Thử cố tình phá vỡ tính đúng đắn toán học (Math Rejection Demo):**
   - Đổi biểu thức trong ô input thành `999*x` hoặc `1/2`.
   - Nhấn **"Lưu chỉnh sửa & xác minh lại"**.
   - **Chỉ ra cho mentor thấy:** Huy hiệu đổi sang **"Verification Failed"** màu đỏ, cảnh báo tiếng Việt xuất hiện, và nút duyệt bị vô hiệu hóa hoàn toàn!
5. **Thao tác 3: Sửa lại công thức đúng & Duyệt:**
   - Đổi lại thành `1/3`, lưu lại -> Trở lại **"SymPy Verified"**.
   - Nhấn **"Duyệt bản thảo bài học"**.
   - **Chỉ ra cho mentor thấy:** Mã Artifact bất biến `art_draft_...` được cấp phát với contentHash SHA-256.

---

### Kịch Bản Dự Phòng (Offline Fallback Playbook — 100% Tin Cậy)

Nếu mạng bị mất hoặc môi trường tại hội trường không cho phép render video 3 phút trực tiếp:

1. **Mở video đã được render sẵn bằng trình phát video:**
   ```powershell
   Invoke-Item outputs\job-20261108055404-a35f979f\final.mp4
   ```
2. **Trình chiếu báo cáo kiểm định chất lượng (Visual QA Report):**
   ```powershell
   Get-Content outputs\job-20261108055404-a35f979f\visual-qa-report.json | ConvertFrom-Json | Select-Object -ExpandProperty checks
   ```
3. **Mở contact sheet hình ảnh các khung hình mẫu:**
   ```powershell
   Invoke-Item outputs\job-20261108055404-a35f979f\contact-sheet.png
   ```
4. **Chạy kiểm thử Playwright Chromium nhanh để chứng minh hệ thống hoạt động thật:**
   ```powershell
   pnpm --filter @luminalearn/web test:e2e
   ```
   *(Thời gian chạy: ~20 giây, 2/2 bài test PASS trực tiếp trên trình duyệt Chromium thật).*

---

## 3. Câu Hỏi Kỹ Thuật Thường Gặp (Mentor Q&A Defense)

### Q1: Tại sao cần SymPy khi Gemini đã rất thông minh?
> **Trả lời:** LLM sinh văn bản theo xác suất (probabilistic). Dù mô hình lớn đến đâu, vẫn tồn tại tỷ lệ ảo giác dấu trừ, số mũ, hoặc tính sai tích phân phức tạp. Trong giáo dục, thông tin sai lệch là tối kỵ. SymPy là một hệ thống tính toán đại số máy tính (CAS - Computer Algebra System) xác định (deterministic). Việc bắt buộc mọi phát biểu toán học phải vượt qua SymPy tạo nên một 'hàng rào thép' (fail-closed barrier) bảo vệ học sinh.

### Q2: Các bạn giải quyết bài toán quota Free Tier của Gemini như thế nào?
> **Trả lời:** Chúng tôi triển khai `GeminiRequestBudget` với giới hạn cứng tối đa 4 request văn bản và 5 request TTS cho mỗi job. Hệ thống loại bỏ hoàn toàn cơ chế retry lồng nhau (nested retry amplification), ngắt ngay lập tức khi gặp mã lỗi 429 (`RESOURCE_EXHAUSTED`), và mặc định toàn bộ hệ thống ở chế độ **Offline Mock Mode (0 request ra bên ngoài)**. Live API chỉ được gọi khi giáo viên chủ động bật xác nhận tường minh.

### Q3: Tính bất biến của `ApprovedRenderArtifactV2` hoạt động ra sao?
> **Trả lời:** Sau khi giáo viên duyệt, toàn bộ kịch bản, cấu hình render, công thức và chứng minh của SymPy được tuần tự hóa theo chuẩn Canonical JSON và tính mã băm SHA-256 (`contentHash`). Worker kết xuất (Manim + Remotion) chỉ nhận `artifactId`, đọc trực tiếp từ đĩa và tính lại mã băm. Nếu phát hiện sai lệch dù chỉ 1 ký tự, worker dừng ngay lập tức với lỗi `artifact_tampered`.

