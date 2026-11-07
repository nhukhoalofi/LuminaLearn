export type LuminaErrorCode =
  | 'unsupported_topic'
  | 'invalid_document'
  | 'extraction_failed'
  | 'unsupported_visualization'
  | 'mathematical_verification_failed'
  | 'source_evidence_missing'
  | 'narration_invalid'
  | 'tts_unavailable'
  | 'render_failed'
  | 'asset_validation_failed'
  | 'invalid_request'
  | 'internal_error';

export interface SafeErrorResponse {
  code: LuminaErrorCode;
  message: string;
  httpStatus: number;
  details?: unknown;
}

export class LuminaError extends Error {
  constructor(
    public readonly code: LuminaErrorCode,
    message: string,
    public readonly httpStatus: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LuminaError';
  }
}

const ERROR_MESSAGE_MAP: Record<LuminaErrorCode, { message: string; httpStatus: number }> = {
  unsupported_topic: {
    message: 'Chủ đề này chưa nằm trong danh mục giáo trình được hỗ trợ của LuminaLearn.',
    httpStatus: 400
  },
  invalid_document: {
    message: 'Tài liệu cung cấp không hợp lệ hoặc không thể xử lý.',
    httpStatus: 400
  },
  extraction_failed: {
    message: 'Không thể trích xuất văn bản từ tài liệu đã tải lên.',
    httpStatus: 422
  },
  unsupported_visualization: {
    message: 'Mô hình trực quan toán học này chưa được đăng ký trong hệ thống.',
    httpStatus: 400
  },
  mathematical_verification_failed: {
    message: 'Mệnh đề toán học trong bài học không vượt qua kiểm định tính đúng đắn của SymPy.',
    httpStatus: 422
  },
  source_evidence_missing: {
    message: 'Không tìm thấy trích dẫn nguồn xác thực trong tài liệu đối chiếu.',
    httpStatus: 400
  },
  narration_invalid: {
    message: 'Kịch bản lời thoại hoặc phụ đề không phù hợp với thời lượng phân đoạn.',
    httpStatus: 400
  },
  tts_unavailable: {
    message: 'Dịch vụ tổng hợp giọng đọc Text-to-Speech hiện chưa sẵn sàng cấu hình.',
    httpStatus: 503
  },
  render_failed: {
    message: 'Quá trình render hoạt họa toán học hoặc video gặp lỗi hệ thống.',
    httpStatus: 500
  },
  asset_validation_failed: {
    message: 'Tệp video trung gian không đáp ứng chuẩn kỹ thuật độ phân giải hoặc khung hình.',
    httpStatus: 500
  },
  invalid_request: {
    message: 'Dữ liệu yêu cầu không hợp lệ.',
    httpStatus: 400
  },
  internal_error: {
    message: 'Hệ thống gặp lỗi nội bộ trong quá trình xử lý bài học.',
    httpStatus: 500
  }
};

/**
 * Chuyển đổi ngoại lệ bất kỳ thành phản hồi an toàn cho người dùng,
 * không làm rò rỉ stack trace hoặc bí mật hệ thống.
 */
export function toSafeUserFacingError(error: unknown): SafeErrorResponse {
  if (error instanceof LuminaError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      details: error.details
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);

  for (const [codeKey, mapping] of Object.entries(ERROR_MESSAGE_MAP)) {
    const code = codeKey as LuminaErrorCode;
    if (rawMessage.toLowerCase().includes(code.toLowerCase())) {
      return {
        code,
        message: mapping.message,
        httpStatus: mapping.httpStatus
      };
    }
  }

  return {
    code: 'internal_error',
    message: ERROR_MESSAGE_MAP.internal_error.message,
    httpStatus: ERROR_MESSAGE_MAP.internal_error.httpStatus
  };
}

