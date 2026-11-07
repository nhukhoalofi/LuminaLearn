# Gemini TTS trong LuminaLearn

LuminaLearn dùng Gemini cho hai mục đích độc lập:

- `renderMode=mock|live` chọn cách tạo nội dung bài học.
- `narrationMode=none|provided_audio|google_cloud_tts|gemini_tts` chọn nguồn âm thanh.

Vì vậy `mock + gemini_tts` vẫn thực hiện yêu cầu mạng và có thể tiêu thụ quota. Hệ thống không tự gọi Gemini TTS chỉ vì một khóa API tồn tại; người dùng phải chọn rõ chế độ này.

## Cấu hình

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts
GEMINI_TTS_VOICE=Kore
GEMINI_TTS_LANGUAGE=vi
TTS_PROVIDER=gemini
```

`gemini-3.8-flash-lite-tts` và giọng `Kore` được liệt kê trong tài liệu chính thức. Với họ Gemini 3.8, adapter dùng Interactions API, giữ transcript trong trường `text`, đưa phong cách đọc vào annotation `speech_metadata`, và yêu cầu audio unary. WAV trả về được kiểm tra rồi chuẩn hóa thành MP3 mono 24 kHz bằng FFmpeg. Các model preview cũ dùng request `generateContent` tương thích với SDK.

Nguồn chính thức:

- [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models)

Mỗi phiên provider kiểm tra model qua API trước lần tổng hợp đầu tiên. Payload rỗng, MIME không hỗ trợ, WAV sai header, PCM lỗi căn chỉnh, lỗi xác thực, quota, model không tồn tại và timeout đều làm job thất bại; không tạo audio rỗng thay thế.

## Smoke test có tính phí/quota

Smoke launcher chủ động nạp duy nhất file `.env` ở repository root, không phụ thuộc current working directory, không ghi secret ra log và không ghi đè biến môi trường đã được process cấu hình.

Lệnh sau cố ý yêu cầu cờ ủy quyền và chỉ tạo một câu ngắn:

```powershell
pnpm --filter @luminalearn/hybrid-renderer smoke:gemini-tts -- --live-gemini-tts --output outputs/gemini-tts-smoke.mp3
```

Không có `--live-gemini-tts`, lệnh dừng trước khi tạo client/request. Kết quả thành công in model, voice, codec, thời lượng đo bằng FFprobe và đường dẫn đầu ra. Không chạy smoke test này trong test suite mặc định.
