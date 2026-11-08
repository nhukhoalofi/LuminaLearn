# LuminaLearn V2.4.2 — Mentor Demo Playbook & Technical Q&A

## A. Pitch 30 Giây (30-Second Elevator Pitch)

> **"LuminaLearn là hệ thống AI tạo video bài giảng Toán học có kiểm chứng hình thức (Formally Verified Educational Video Studio).**
> Khác với các công cụ tạo video AI thông thường vốn dễ 'ảo giác' (hallucinate) công thức và vẽ sai đồ thị, LuminaLearn kết hợp **Gemini Multi-Agent** có đối chiếu trích dẫn nguyên văn từ tài liệu học tập với **cổng kiểm định toán học độc lập bằng SymPy**, **trình đạo diễn điện ảnh sư phạm (Lemo-Opuscar + Video Shotcraft)**, **quy trình giáo viên duyệt tạo bất biến (`ApprovedRenderArtifactV2`)**, và **engine kết xuất lai Manim + Remotion + Gemini TTS tiếng Việt**. Mọi mệnh đề toán học đều phải được SymPy chứng minh đúng và giáo viên phê duyệt trước khi một khung hình video nào được phép xuất ra."

---

## B. Sơ Đồ Kiến Trúc Tổng Thể (End-to-End Architecture)

```
[Tài liệu .md/.txt/.docx/.pdf hoặc Chủ đề]
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. Document Ingestion & Grounding (DocumentAnalyst)           │
│    - Trích xuất văn bản, chia chunk, đóng dấu UNTRUSTED DATA   │
│    - Đối chiếu trích dẫn nguyên văn (exact quote verification)│
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. Curriculum Planning (CurriculumPlanner + Gemini / Mock)    │
│    - Sinh LessonPlanV2 + MathVisualizationSpecV2              │
│    - CẤM tự đánh dấu verified (chống AI self-verification)    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. Independent Formal Verification Gate (SymPy Python Engine) │
│    - Kiểm chứng đạo hàm, hệ số góc cát tuyến, tổng Riemann,   │
│      giới hạn và tích phân xác định trên đúng MathSpec        │
│    - Fail-closed: Sai 1 mệnh đề -> Chặn ngay, không tạo video │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. Storyboard & Film Direction (Storyboard + FilmDirector)    │
│    - Áp dụng Lemo-Opuscar style (clean_educational_infographic│
│      hoặc math_chalkboard) & Shotcraft motion components      │
│    - NarrationPlannerV2 sinh lời dẫn + gợi ý phát âm tiếng Việt│
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. Human-in-the-Loop Draft Review & Immutable Approval        │
│    - Giáo viên sửa tiêu đề, lời dẫn, công thức -> Chạy lại    │
│      SymPy -> Duyệt -> Đóng băng ApprovedRenderArtifactV2     │
│      (SHA-256 contentHash + verificationBindingHash)          │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 6. Hybrid Rendering & Visual QA (Manim + Gemini TTS + Remotion│
│    - Manim dựng hình học toán học chính xác                   │
│    - Gemini TTS (giọng Kore vi-VN) chuẩn hóa MP3 24kHz        │
│    - Remotion ghép cảnh Shotcraft + phụ đề đồng bộ timeline   │
│    - FFprobe + Visual QA (contact-sheet.png + blackdetect)    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
[final.mp4 (720x1280@24fps) + subtitles.srt + visual-qa-report.json]
```

---

## C. Vai Trò Của Từng Agent Trong Pipeline

1. **`TopicRouter`** ([`packages/agent/src/orchestration/router.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/router.ts)):
   - Phân loại yêu cầu vào chủ đề được hỗ trợ (`calculus.derivative.intuition` hoặc `calculus.integral.riemann_sum`), gắn danh sách `supportedTemplates` và `requiredValidators`. Nếu chủ đề ngoài phạm vi (ví dụ tôpô đại số), chuyển sang `needs_review` thay vì bịa nội dung.
2. **`DocumentAnalyst` & `DocumentGroundingService`** ([`packages/agent/src/orchestration/document-grounding.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/document-grounding.ts)):
   - Trích xuất khái niệm và mệnh đề ứng viên từ tài liệu, đóng gói `SourceContextBundle` giới hạn kích thước (`maxExcerpts = 12`, `maxExcerptCharacters = 1200`) với nhãn `trust: 'untrusted_document_content'`, và kiểm tra trích dẫn nguyên văn (`matchType === 'exact'`).
3. **`CurriculumPlanner`** ([`packages/agent/src/orchestration/curriculum-planner.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/curriculum-planner.ts)):
   - Lập kế hoạch bài học `LessonPlanV2` và `MathVisualizationSpecV2`. Từ chối ngay lập tức (`provider_self_verification_rejected`) nếu AI dám tự điền `verificationStatus: 'verified'`.
4. **`MathVerificationService` (SymPy Gate)** ([`packages/agent/src/orchestration/math-verifier.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/math-verifier.ts)):
   - Gọi Python SymPy CLI độc lập (`services/math-engine`) để kiểm chứng từng `validatorKey` (`polynomial_derivative`, `secant_slope`, `limit_at_zero`, `value_at_point`, `riemann_sum_limit`, `definite_integral`) trên đúng hàm số và tham số của `MathVisualizationSpecV2`.
5. **`VisualStoryboardDirectorV2` & `EducationalFilmDirector`** ([`storyboard-director.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/storyboard-director.ts), [`educational-film-director.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/educational-film-director.ts)):
   - Chuyển chuỗi bước sư phạm thành `StoryboardV2` và bản phân cảnh điện ảnh `TeachingTreatmentV2` có khóa chặt `lockedClaimIds` và gán từng cảnh với motion component tương ứng (`concept_title_reveal`, `manim_verified_clip`, `step_formula_reveal`, `before_after_comparison`).
6. **`NarrationPlannerV2`** ([`packages/agent/src/orchestration/narration-planner.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/narration-planner.ts)):
   - Sinh lời dẫn (`text`) tách biệt với phụ đề (`subtitleText`) và gợi ý phát âm ký hiệu toán học tiếng Việt (`pronunciationHints`), kiểm tra khớp 100% tập `sceneId` và tập `verifiedClaimIds`.
7. **`QualityReviewer`** ([`packages/agent/src/orchestration/quality-reviewer.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/quality-reviewer.ts)):
   - Kiểm tra 5 cổng chất lượng cuối cùng: SymPy verification, template registry support, timeline frame consistency, narration scene coverage, và document grounding evidence.

---

## D. MCP Server & Agent Skills — Bằng Chứng Thực Thi Thực Tế

- **Agent Skills**:
  - Codex Skill: [`.agents/skills/luminalearn-video-studio/SKILL.md`](file:///d:/Hackathon/LuminaLearn/.agents/skills/luminalearn-video-studio/SKILL.md)
  - Claude Code Skill: [`.claude/skills/luminalearn-video-studio/SKILL.md`](file:///d:/Hackathon/LuminaLearn/.claude/skills/luminalearn-video-studio/SKILL.md)
- **Read-Only MCP Server**: [`packages/mcp-server/src/server.ts`](file:///d:/Hackathon/LuminaLearn/packages/mcp-server/src/server.ts)
- **Lệnh Chạy Thực Tế Để Demo Với Mentor (< 3 giây)**:
  ```powershell
  pnpm --filter @luminalearn/mcp-server demo:workflow -- job-20261107171652-3cc5c0df
  ```
- **5 MCP Tools Được Gọi Tuần Tự Qua Stdio**:
  1. `list_visual_styles` -> Liệt kê 2 style chuẩn (`math_chalkboard`, `clean_educational_infographic`).
  2. `list_math_templates` -> Liệt kê 5 template toán học đã đăng ký trong `MathTemplateRegistry`.
  3. `validate_math_spec` -> Kiểm tra schema của `MathVisualizationSpecV2` cho bài học Tổng Riemann.
  4. `inspect_storyboard` -> Đọc và xác thực `storyboard.json` của job `job-20261107171652-3cc5c0df`.
  5. `inspect_render_job` -> Trả về báo cáo FFprobe (`720x1280@24`, `31.625s`, `h264`/`aac`) và `visual-qa-report.json`.

---

## E. Chuyển Thể Mã Nguồn Mở: Video Shotcraft & Lemo-Opuscar

Chi tiết truy vết tại [`docs/oss-adoption.md`](file:///d:/Hackathon/LuminaLearn/docs/oss-adoption.md):

1. **Từ `Vincentwei1021/video-shotcraft` (Apache-2.0)** -> [`packages/animation/src/`](file:///d:/Hackathon/LuminaLearn/packages/animation/src/index.ts):
   - **`ConceptTitleReveal.tsx`**: Chuyển thể công thức nhịp chuyển động `brace-expand` (dấu ngoặc `[` `]` bung mở theo hàm lò xo có độ vọt có kiểm soát `safeExpansion <= 1.08`, giữ nhịp đọc tiêu đề tiếng Việt, thu gọn mượt ở cuối cảnh).
   - **`StepFormulaReveal.tsx`**: Chuyển thể `type-assembly-moves` (lắp ghép từng bước biến đổi công thức theo độ trễ `stagger` phụ thuộc thời lượng cảnh, làm nổi bật kết quả cuối).
   - **`BeforeAfterComparison.tsx`**: Chuyển thể `before-after-slider-scrub` (nhịp 3 pha: quét nhanh tạo ấn tượng -> dừng ngắn -> kéo chậm phân tích sự hội tụ).
2. **Từ `lemomo-ai/lemo-opuscar` (MIT)** -> [`educational-film-director.ts`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/educational-film-director.ts), [`visual-style.ts`](file:///d:/Hackathon/LuminaLearn/packages/scene-schema/src/v2/visual-style.ts), [`visual-qa.ts`](file:///d:/Hackathon/LuminaLearn/packages/hybrid-renderer/src/visual-qa.ts):
   - **Treatment-First Direction**: Lập bản thiết kế phân cảnh (`TeachingTreatmentV2`) từ mục tiêu bài học trước khi render, nhưng khóa chặt `lockedClaimIds` để đạo diễn hình ảnh không bao giờ làm sai lệch công thức toán đã được SymPy duyệt.
   - **Style Guides**: Chuyển thể nguyên tắc bảng phấn (`math_chalkboard`) và đồ họa dữ liệu (`clean_educational_infographic`) thành các ràng buộc kích thước chữ tối thiểu (`>= 25px`) và vùng an toàn (`48px`).
   - **Contact-Sheet Visual QA**: Tự động trích xuất `contact-sheet.png` (4 khung hình đại diện), quét `blackdetect` bằng FFmpeg, và kiểm tra tọa độ hộp phụ đề không đè lên vùng công thức.

---

## F. Kịch Bản Demo Offline Đảm Bảo Thành Công 100% (Guaranteed Offline Demo Flow)

> **Ưu điểm**: Không phụ thuộc mạng, không tốn quota API, chứng minh đầy đủ tính năng từ tài liệu -> SymPy -> duyệt bản thảo -> MCP -> Video MP4 thực tế.

### Bước 1: Chứng minh MCP Server & Video Thực Tế Đã Render (1 phút)
1. Chạy lệnh kiểm tra MCP workflow trên terminal:
   ```powershell
   pnpm --filter @luminalearn/mcp-server demo:workflow -- job-20261107171652-3cc5c0df
   ```
2. Mở trực tiếp các file kết quả thực tế trong `outputs/job-20261107171652-3cc5c0df/`:
   - Phát video [`outputs/job-20261107171652-3cc5c0df/final.mp4`](file:///d:/Hackathon/LuminaLearn/outputs/job-20261107171652-3cc5c0df/final.mp4) (`31.625s`, `720x1280`, 24fps, có phụ đề tiếng Việt đồng bộ timeline và luồng âm thanh AAC `silent_fixture` `-91.0 dB` phục vụ kiểm thử offline không tốn quota; để phát giọng đọc có tín hiệu âm thanh thực tế (`audible_non_silent`), dùng `--provided-audio` hoặc bật Gemini TTS opt-in).
   - Mở [`outputs/job-20261107171652-3cc5c0df/contact-sheet.png`](file:///d:/Hackathon/LuminaLearn/outputs/job-20261107171652-3cc5c0df/contact-sheet.png) và [`visual-qa-report.json`](file:///d:/Hackathon/LuminaLearn/outputs/job-20261107171652-3cc5c0df/visual-qa-report.json) để chỉ rõ các cổng kiểm tra tự động (phân biệt `audio_presence` với `audible_speech`) và trạng thái `requires_manual_review` trung thực.
   - Mở [`outputs/job-20261107171652-3cc5c0df/verification-report.json`](file:///d:/Hackathon/LuminaLearn/outputs/job-20261107171652-3cc5c0df/verification-report.json) để chỉ rõ SymPy đã chứng minh $\int_0^1 x^2 dx = 1/3$ và $\lim_{n\to\infty} S_n = 1/3$.

### Bước 2: Demo Luồng Web Tương Tác & Cổng Chặn SymPy (2 phút)
1. Khởi động ứng dụng web:
   ```powershell
   pnpm dev:web
   ```
   Mở `http://localhost:3000`.
2. Chọn **"📄 Tài liệu nguồn (Document-to-Video)"**, dán đoạn văn bản giáo trình:
   ```text
   # Bài đọc: Tích phân xác định và Tổng Riemann
   Trên đoạn [0, 1], diện tích dưới đường cong f(x) = x^2 được xấp xỉ bằng tổng diện tích các hình chữ nhật phân hoạch. Tích phân xác định của x^2 trên [0, 1] bằng 1/3.
   ```
3. Nhấn **"⚡ Phân tích & Trích xuất tài liệu"**, chọn **Mock AI Engine**, chọn phong cách **"Đồ họa giáo dục tinh gọn"**, nhấn **"📋 Xem trước bản thảo (Draft Review)"**.
4. **Chứng minh cổng chặn SymPy trực tiếp trước mặt Mentor**:
   - Trong ô biểu thức của mệnh đề `definite_integral`, sửa `1/3` thành **`1/2`** (một kết quả sai).
   - Nhấn **"Lưu chỉnh sửa & chạy lại SymPy"**.
   - Chỉ cho Mentor thấy: Nhãn lập tức chuyển sang **`✗ Verification Failed`**, thông báo lỗi SymPy hiện rõ, và nút **"❌ Không thể duyệt: Mệnh đề toán học chưa vượt qua SymPy"** bị khóa cứng!
5. **Chứng minh sửa đúng & tạo Artifact bất biến**:
   - Sửa lại biểu thức thành **`1/3`**, chỉnh sửa tiêu đề hoặc lời dẫn tùy ý, nhấn **"Lưu chỉnh sửa & chạy lại SymPy"**.
   - Nhãn chuyển lại thành **`✓ SymPy Verified`** (phiên bản bản thảo tăng lên `v3`).
   - Nhấn **"✅ Duyệt bản thảo & Render Video Remotion"** -> Hệ thống đóng băng `ApprovedRenderArtifactV2` có mã băm SHA-256 trong `outputs/.artifacts/` và khởi chạy tiến trình kết xuất.

### Bước 3: Chứng minh Bộ Kiểm Thử Автоматическое (30 giây)
```powershell
pnpm test:math-engine
pnpm --filter @luminalearn/agent test
```

---

## G. Kịch Bản Demo Gemini Live & Gemini TTS (Opt-In — Chỉ Chạy Khi Được Cho Phép)

> **Điều kiện**: File `.env` ở thư mục gốc có `GEMINI_API_KEY` hợp lệ và người thuyết trình/mentor đồng ý thực hiện lệnh gọi API có tính phí.

1. **Kiểm tra nhanh Gemini TTS (1 câu ngắn, tốn tối thiểu quota)**:
   ```powershell
   pnpm --filter @luminalearn/hybrid-renderer tts:gemini:smoke -- --live-gemini-tts --output outputs/gemini-tts-mentor-smoke.mp3
   ```
   Lệnh này gọi model `gemini-3.8-flash-lite-tts` với giọng `Kore` (`vi-VN`), đọc câu `"x bình phương có đạo hàm là hai x."`, chuẩn hóa sang MP3 24kHz và in ra JSON chứa `durationSeconds` thực tế từ FFprobe.
2. **Trên giao diện Web (`http://localhost:3000`)**:
   - Chọn **Gemini Live Multi-Agent** và **Gemini TTS**.
   - Tạo bản thảo -> Kiểm tra các mệnh đề do Gemini sinh ra đã được SymPy xác minh -> Duyệt và render.

---

## H. Rủi Ro, Giới Hạn Kỹ Thuật & Phương Án Dự Phòng (Risks, Limitations & Fallbacks)

1. **Rủi ro mạng / hết quota Gemini API khi demo trực tiếp**:
   - **Dự phòng**: Chuyển ngay sang **Mock AI Engine** trên giao diện Web (vẫn chạy **SymPy thật**, **Manim thật**, **Remotion thật**) và mở video mẫu đã render sẵn tại `outputs/job-20261107171652-3cc5c0df/final.mp4`.
2. **Thời gian kết xuất Manim + Remotion (khoảng 45–90 giây trên CPU local)**:
   - **Dự phòng**: Trong khi chờ thanh tiến độ của job mới chạy qua các bước `planning -> validating -> rendering_manim -> rendering_remotion`, mở song song job hoàn chỉnh `job-20261107171652-3cc5c0df` để giải thích `contact-sheet.png`, `verification-report.json` và chạy MCP demo.
3. **Giới hạn phạm vi toán học hiện tại (Honest Scope)**:
   - Engine V2.4.2 hiện hỗ trợ sâu và kiểm chứng hình thức 2 chủ đề Giải tích cốt lõi với hàm đa thức (`calculus.derivative.intuition` và `calculus.integral.riemann_sum`). Các chủ đề ngoài danh sách được `TopicRouter` chặn an toàn ở trạng thái `needs_review` thay vì sinh hình minh họa sai.
4. **Chi tiết hiển thị nhỏ trên Manim Windows Font**:
   - Trong `contact-sheet.png` (khung hình 379), nhãn trục `y` hơi chạm dấu của chữ `ổ` trong tiêu đề phụ của Manim và ký tự phân cách dòng trạng thái hiển thị ô vuông mảnh do font Pango mặc định trên Windows. Báo cáo `visual-qa-report.json` giữ nguyên trạng thái `requires_manual_review` một cách trung thực.

---

## I. Phân Công Vai Trò Cho Nhóm 3 Người (3-Person Team Demo Roles)

| Thành viên | Vai trò trong buổi Demo | Phần phụ trách chính |
|---|---|---|
| **Thành viên 1 (Lead / Product & Architecture)** | Người dẫn chuyện (Presenter) | Trình bày Pitch 30 giây, sơ đồ kiến trúc V2.4.2, vấn đề "AI hallucination trong giáo dục STEM" và cách LuminaLearn giải quyết bằng SymPy + Human Approval. |
| **Thành viên 2 (AI Agents, Grounding & Verification)** | Người điều khiển Demo Web & SymPy Gate (Driver) | Thực hiện thao tác trên Web UI: nạp tài liệu, tạo bản thảo, cố tình sửa sai công thức để chứng minh cổng chặn SymPy, sửa lại cho đúng và duyệt tạo `ApprovedRenderArtifactV2`. |
| **Thành viên 3 (Rendering, Motion Studio & MCP/OSS)** | Kỹ sư Hệ thống & QA (Technical Anchor) | Chạy lệnh MCP `demo:workflow` trên terminal, trình bày chuyển thể Video Shotcraft + Lemo-Opuscar (`docs/oss-adoption.md`), mở `contact-sheet.png`, `visual-qa-report.json`, và `final.mp4`. |

---

## J. Bộ Câu Hỏi Mentor Thường Hỏi & Câu Trả Lời Kỹ Thuật Kèm Dẫn Chứng Code

### Q1: "Làm sao các bạn đảm bảo Gemini không tự bịa ra nội dung ngoài tài liệu hoặc tự xác nhận công thức toán của nó là đúng?"
- **Trả lời**: Chúng tôi áp dụng 3 lớp khóa độc lập trong code:
  1. Nội dung tài liệu đưa vào prompt được giới hạn kích thước và gắn nhãn `trust: 'untrusted_document_content'` tại [`document-grounding.ts:278-302`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/document-grounding.ts#L278-L302).
  2. Mọi trích dẫn `sourceEvidence` do Gemini trả về đều bị kiểm tra ngược lại trên `DocumentStore` bằng `verifyQuoteInDocument()` tại [`orchestrator.ts:181-189`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/orchestrator.ts#L181-L189) — nếu không khớp nguyên văn (`matchType !== 'exact'`), hệ thống ném lỗi `fabricated_source_reference`.
  3. Tại [`curriculum-planner.ts:40-42`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/curriculum-planner.ts#L40-L42), nếu Gemini trả về bất kỳ mệnh đề nào có `verificationStatus === 'verified'`, hệ thống lập tức từ chối với lỗi `provider_self_verification_rejected`. Chỉ có tiến trình Python SymPy độc lập tại [`math-verifier.ts:79-135`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/math-verifier.ts#L79-L135) mới có quyền đánh dấu `verified`.

### Q2: "Nếu giáo viên sửa nội dung ở bước duyệt bản thảo (Draft Review), liệu lúc render hệ thống có gọi lại AI và làm mất bản sửa của giáo viên không?"
- **Trả lời**: Tuyệt đối không. Khi giáo viên nhấn duyệt, [`draft-manager.ts:451-622`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/draft-manager.ts#L451-L622) chạy lại SymPy lần cuối, đóng băng đối tượng `ApprovedRenderArtifactV2` bằng `deepFreeze()`, tính mã băm chuẩn tắc SHA-256 `contentHash` và `verificationBindingHash`, rồi lưu nguyên tử xuống `outputs/.artifacts/`. Khi render, [`pipeline-v2.ts:121-138`](file:///d:/Hackathon/LuminaLearn/packages/hybrid-renderer/src/pipeline-v2.ts#L121-L138) và [`pipeline-v2.ts:196-207`](file:///d:/Hackathon/LuminaLearn/packages/hybrid-renderer/src/pipeline-v2.ts#L196-L207) kiểm tra `verifyArtifactIntegrity(artifact)` và lấy trực tiếp `lessonPlan`, `storyboard`, `narrationPlan`, `mathSpec` từ artifact đã duyệt — hoàn toàn không gọi lại `LessonOrchestrator`. Nếu bản thảo bị sửa sau khi duyệt, `isArtifactCurrentlyApproved()` trả về `false` và thu hồi quyền render ngay lập tức (`artifact_revoked`).

### Q3: "Các bạn đã học và áp dụng được gì từ hai repo `video-shotcraft` và `lemo-opuscar` của mentor?"
- **Trả lời**:
  - Từ **`video-shotcraft`**, chúng tôi học cách thiết kế nhịp điệu chuyển động (choreography) có giới hạn thời gian rõ ràng và tự cài đặt 3 component trong `@luminalearn/animation`: [`ConceptTitleReveal.tsx`](file:///d:/Hackathon/LuminaLearn/packages/animation/src/ConceptTitleReveal.tsx) (từ `brace-expand`), [`StepFormulaReveal.tsx`](file:///d:/Hackathon/LuminaLearn/packages/animation/src/StepFormulaReveal.tsx) (từ `type-assembly-moves`), và [`BeforeAfterComparison.tsx`](file:///d:/Hackathon/LuminaLearn/packages/animation/src/BeforeAfterComparison.tsx) (từ `before-after-slider-scrub`).
  - Từ **`lemo-opuscar`**, chúng tôi chuyển thể quy trình đạo diễn ưu tiên kịch bản (`DIRECTOR.md`) thành [`EducationalFilmDirector`](file:///d:/Hackathon/LuminaLearn/packages/agent/src/orchestration/educational-film-director.ts) có khóa chặt `lockedClaimIds`, chuyển thể 2 bộ quy tắc phong cách (`styles/chalkboard` và `styles/dataviz`) thành `VISUAL_STYLE_REGISTRY` tại [`visual-style.ts`](file:///d:/Hackathon/LuminaLearn/packages/scene-schema/src/v2/visual-style.ts), và xây dựng quy trình hậu kiểm tự động tạo `contact-sheet.png` + kiểm tra chồng lấn phụ đề tại [`visual-qa.ts`](file:///d:/Hackathon/LuminaLearn/packages/hybrid-renderer/src/visual-qa.ts).

### Q4: "Làm sao âm thanh từ Gemini TTS khớp được với hình ảnh Manim và phụ đề trong Remotion mà không bị lệch?"
- **Trả lời**: Trong [`pipeline-v2.ts:332-431`](file:///d:/Hackathon/LuminaLearn/packages/hybrid-renderer/src/pipeline-v2.ts#L332-L431), chúng tôi thực hiện quy trình đồng bộ 2 pha:
  1. Pha 1: Render clip Manim trước, dùng FFprobe đo chính xác số frame thực tế (`probeAndVerifyVideoAsset`), và cập nhật lại `durationFrames` của các cảnh trong storyboard (`measuredTimeline`).
  2. Pha 2: Tổng hợp giọng đọc qua [`GeminiTtsProvider`](file:///d:/Hackathon/LuminaLearn/packages/hybrid-renderer/src/gemini-tts.ts) (sau khi đã chuyển ký hiệu toán sang cách đọc tiếng Việt bằng `buildSpokenNarrationText`), chuẩn hóa bằng FFmpeg về MP3 24kHz, đo `durationSeconds` thực tế bằng FFprobe, rồi mới biên dịch `RenderManifestV2` cuối cùng để cả `audioAssets` và `subtitleTrack.cues` dùng chung một mốc `startFrame` duy nhất trên timeline.

### Q5: "MCP Server của các bạn có an toàn không? Liệu AI client có thể dùng MCP để đọc file `.env` hay tự ý gọi API trả phí không?"
- **Trả lời**: MCP Server tại [`packages/mcp-server/src/server.ts`](file:///d:/Hackathon/LuminaLearn/packages/mcp-server/src/server.ts) được thiết kế **100% read-only và offline**. Cả 5 tool đều dùng `.strict()` schema của Zod, không nhận đường dẫn file tự do mà chỉ nhận `jobId` khớp biểu thức chính quy `^[a-zA-Z0-9_-]{3,120}$` và chỉ đọc đúng 3 tên file cố định (`storyboard.json`, `final.mp4.metadata.json`, `visual-qa-report.json`) bên trong `outputs/<jobId>/`. Mọi nỗ lực truyền `../.env` hoặc gọi tool ghi dữ liệu đều bị chặn và đã được kiểm chứng bằng unit test tại [`packages/mcp-server/test/discovery.test.ts`](file:///d:/Hackathon/LuminaLearn/packages/mcp-server/test/discovery.test.ts).

