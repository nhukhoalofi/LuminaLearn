import { z } from 'zod';

export interface FormattedErrorIssue {
  field: string;
  code: string;
  message: string;
}

export interface FormattedErrorResponse {
  error: string;
  message: string;
  details?: FormattedErrorIssue[];
  provenance?: string;
}

export function formatZodIssueVietnamese(issue: z.ZodIssue): FormattedErrorIssue {
  const field = issue.path.join('.') || 'gốc';
  let message = issue.message;

  switch (issue.code) {
    case 'too_big':
      if (field.includes('durationSeconds')) {
        message = `Thời lượng phân cảnh (${field}) vượt quá giới hạn tối đa cho phép là ${issue.maximum} giây.`;
      } else {
        message = `Trường '${field}' vượt quá giá trị tối đa cho phép (${issue.maximum}).`;
      }
      break;
    case 'too_small':
      if (field.includes('durationSeconds')) {
        message = `Thời lượng phân cảnh (${field}) phải lớn hơn ${issue.minimum} giây.`;
      } else {
        message = `Trường '${field}' nhỏ hơn giá trị tối thiểu cho phép (${issue.minimum}).`;
      }
      break;
    case 'invalid_type':
      message = `Kiểu dữ liệu của trường '${field}' không hợp lệ (yêu cầu '${issue.expected}', nhưng nhận được '${issue.received}').`;
      break;
    case 'invalid_enum_value':
      message = `Giá trị của trường '${field}' không hợp lệ (chỉ chấp nhận: ${(issue as any).options?.join(', ')}).`;
      break;
    case 'custom':
      message = issue.message || `Dữ liệu tại trường '${field}' không thỏa mãn điều kiện xác thực.`;
      break;
    default:
      message = issue.message || `Dữ liệu không hợp lệ tại trường '${field}'.`;
      break;
  }

  return { field, code: issue.code, message };
}

export function formatApiError(error: unknown, fallbackCode = 'request_failed', provenance = 'server_error'): FormattedErrorResponse {
  if (error instanceof z.ZodError) {
    const details = error.issues.map(formatZodIssueVietnamese);
    const summary = details.map((d) => d.message).join('; ');
    return {
      error: 'validation_error',
      message: `Lỗi định dạng dữ liệu: ${summary}`,
      details,
      provenance
    };
  }

  const errObj = error as { code?: unknown; message?: unknown };
  const code = typeof errObj?.code === 'string' ? errObj.code : fallbackCode;
  let rawMessage = error instanceof Error ? error.message : String(error);

  // If rawMessage is a stringified JSON array from an upstream ZodError
  if (typeof rawMessage === 'string' && rawMessage.trim().startsWith('[') && rawMessage.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.code) {
        const details = (parsed as z.ZodIssue[]).map(formatZodIssueVietnamese);
        return {
          error: 'validation_error',
          message: `Lỗi định dạng dữ liệu: ${details.map((d) => d.message).join('; ')}`,
          details,
          provenance
        };
      }
    } catch {
      // not JSON array, continue
    }
  }

  if (/gemini_transient_failed|high demand|\b503\b|service unavailable|temporarily unavailable/i.test(rawMessage) || code === 'gemini_transient_failed') {
    return {
      error: 'gemini_transient_failed',
      message: 'Gemini đang quá tải tạm thời (HTTP 503 - High Demand từ Google). Hệ thống đã tự động thử lại nhưng máy chủ Google vẫn đang bận. Vui lòng bấm thử lại sau giây lát hoặc chuyển sang Mock offline để tiếp tục ngay lập tức.',
      provenance
    };
  }

  return {
    error: code,
    message: rawMessage,
    provenance
  };
}

