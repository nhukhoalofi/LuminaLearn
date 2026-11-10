/**
 * LuminaLearn V3.0 — Phase 11
 * Vietnamese Narration Normalizer
 *
 * Normalizes mathematical formulas, LaTeX markup, numbers, and AI/ML domain
 * terminology into natural Vietnamese spoken text suitable for TTS engines.
 */

export interface PronunciationHint {
  written: string;
  spoken: string;
}

export interface VietnameseNormalizationOptions {
  pronunciationHints?: PronunciationHint[];
  allowPassThroughUnknownLatex?: boolean;
  wordsPerSecond?: number;
}

export interface VietnameseNormalizationResult {
  normalizedText: string;
  unsupportedTokens: string[];
  wordCount: number;
  estimatedDurationSeconds: number;
}

const SINGLE_DIGIT_VIETNAMESE: Record<string, string> = {
  '0': 'không',
  '1': 'một',
  '2': 'hai',
  '3': 'ba',
  '4': 'bốn',
  '5': 'năm',
  '6': 'sáu',
  '7': 'bảy',
  '8': 'tám',
  '9': 'chín'
};

export function digitSequenceToVietnamese(digits: string): string {
  return digits
    .split('')
    .map((d) => SINGLE_DIGIT_VIETNAMESE[d] ?? d)
    .join(' ');
}

export function integerToVietnamese(num: number): string {
  if (!Number.isFinite(num)) return String(num);
  if (num < 0) return `âm ${integerToVietnamese(Math.abs(num))}`;
  if (num < 10) return SINGLE_DIGIT_VIETNAMESE[String(num)] ?? String(num);
  if (num < 20) {
    if (num === 10) return 'mười';
    if (num === 15) return 'mười lăm';
    return `mười ${SINGLE_DIGIT_VIETNAMESE[String(num % 10)]}`;
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const rem = num % 10;
    const tensStr = tens === 2 ? 'hai mươi' : tens === 4 ? 'bốn mươi' : `${SINGLE_DIGIT_VIETNAMESE[String(tens)]} mươi`;
    if (rem === 0) return tensStr;
    if (rem === 1) return `${tensStr} mốt`;
    if (rem === 4) return `${tensStr} tư`;
    if (rem === 5) return `${tensStr} lăm`;
    return `${tensStr} ${SINGLE_DIGIT_VIETNAMESE[String(rem)]}`;
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rem = num % 100;
    const hundredsStr = `${SINGLE_DIGIT_VIETNAMESE[String(hundreds)]} trăm`;
    if (rem === 0) return hundredsStr;
    if (rem < 10) return `${hundredsStr} linh ${SINGLE_DIGIT_VIETNAMESE[String(rem)]}`;
    return `${hundredsStr} ${integerToVietnamese(rem)}`;
  }
  // For larger numbers, fallback to digit reading
  return digitSequenceToVietnamese(String(num));
}

// AI/ML Terminology dictionary (English / technical -> Vietnamese spoken form)
const AI_TERMINOLOGY_RULES: Array<[RegExp, string]> = [
  [/\bGradient\s+Descent\b/gi, 'phương pháp hạ độ dốc'],
  [/\bPerceptron\b/gi, 'mô hình pơ-sép-tròn'],
  [/\bLoss\s+function\b/gi, 'hàm mất mát'],
  [/\bLoss\b/gi, 'mất mát'],
  [/\bLearning\s+rate\b/gi, 'tốc độ học'],
  [/\bWeight\s+vector\b/gi, 'véc-tơ trọng số'],
  [/\bWeights\b/gi, 'trọng số'],
  [/\bWeight\b/gi, 'trọng số'],
  [/\bBias\b/gi, 'độ lệch'],
  [/\bActivation\s+function\b/gi, 'hàm kích hoạt'],
  [/\bBackpropagation\b/gi, 'thuật toán lan truyền ngược'],
  [/\bSelf-Attention\b/gi, 'cơ chế tự chú ý'],
  [/\bSelf\s+Attention\b/gi, 'cơ chế tự chú ý'],
  [/\bAttention\b/gi, 'cơ chế chú ý'],
  [/\bQuery,\s*Key,\s*Value\b/gi, 'truy vấn, khóa và giá trị'],
  [/\bQueries,\s*Keys,\s*Values\b/gi, 'truy vấn, khóa và giá trị'],
  [/\bLocal\s+minim(?:um|a)\b/gi, 'cực tiểu cục bộ'],
  [/\bGlobal\s+minim(?:um|a)\b/gi, 'cực tiểu toàn cục'],
  [/\bConvergence\b/gi, 'sự hội tụ'],
  [/\bConverge\b/gi, 'hội tụ'],
  [/\bEpoch\b/gi, 'chu kỳ huấn luyện'],
  [/\bStep\s+size\b/gi, 'bước nhảy']
];

// Mathematical & Symbol Replacements
const MATH_EXPRESSION_RULES: Array<[RegExp, string]> = [
  // Binomial and polynomial expansions
  [/\((a\s*\+\s*b)\)\^2/gi, 'a cộng b tất cả bình phương'],
  [/\((a\s*-\s*b)\)\^2/gi, 'a trừ b tất cả bình phương'],
  [/\((a\s*\+\s*b)\)\^3/gi, 'a cộng b tất cả lập phương'],
  [/\((a\s*-\s*b)\)\^3/gi, 'a trừ b tất cả lập phương'],
  [/\(a\s*\+\s*b\)\s*²|\(a\s*\+\s*b\)\s*\^2/gi, 'a cộng b tất cả bình phương'],
  [/\(a\s*-\s*b\)\s*²|\(a\s*-\s*b\)\s*\^2/gi, 'a trừ b tất cả bình phương'],
  [/\(a\s*\+\s*b\)\s*³|\(a\s*\+\s*b\)\s*\^3/gi, 'a cộng b tất cả lập phương'],
  [/\(a\s*-\s*b\)\s*³|\(a\s*-\s*b\)\s*\^3/gi, 'a trừ b tất cả lập phương'],
  [/\ba\^2\s*-\s*b\^2\b/gi, 'a bình phương trừ b bình phương'],
  [/\ba²\s*-\s*b²\b/gi, 'a bình phương trừ b bình phương'],
  [/\ba\^3\s*\+\s*b\^3\b/gi, 'a lập phương cộng b lập phương'],
  [/\ba³\s*\+\s*b³\b/gi, 'a lập phương cộng b lập phương'],
  [/\ba\^3\s*-\s*b\^3\b/gi, 'a lập phương trừ b lập phương'],
  [/\ba³\s*-\s*b³\b/gi, 'a lập phương trừ b lập phương'],
  [/\ba\^2\s*\+\s*2ab\s*\+\s*b\^2\b/gi, 'a bình phương cộng hai a b cộng b bình phương'],
  [/\ba²\s*\+\s*2ab\s*\+\s*b²\b/gi, 'a bình phương cộng hai a b cộng b bình phương'],
  [/\ba\^2\s*-\s*2ab\s*\+\s*b\^2\b/gi, 'a bình phương trừ hai a b cộng b bình phương'],
  [/\ba²\s*-\s*2ab\s*\+\s*b²\b/gi, 'a bình phương trừ hai a b cộng b bình phương'],

  // Derivatives & Integrals
  [/f['′]\(x\)/gi, 'f phẩy x'],
  [/f['′]\s*x\b/gi, 'f phẩy x'],
  [/\by['′]\b/gi, 'y phẩy'],
  [/\\frac\{df\}\{dx\}/gi, 'đạo hàm của f theo x'],
  [/\\frac\{d\}\{dx\}/gi, 'đạo hàm theo x'],
  [/\\frac\{\\partial\s*([a-zA-Z0-9]+)\}\{\\partial\s*([a-zA-Z0-9]+)\}/gi, 'đạo hàm riêng của $1 theo $2'],
  [/\\nabla\s*L\b/gi, 'gradient của L'],
  [/\\nabla/gi, 'gradient'],
  [/\\int_0\^1\s*x\^2\s*dx/gi, 'tích phân từ không đến một của x bình phương theo x'],
  [/∫₀¹\s*x²\s*dx/gi, 'tích phân từ không đến một của x bình phương theo x'],
  [/\\int_\{([^}]+)\}\^\{([^}]+)\}/gi, 'tích phân từ $1 đến $2 của'],
  [/\\int_([a-zA-Z0-9])\^([a-zA-Z0-9])/gi, 'tích phân từ $1 đến $2 của'],
  [/\\int\b/gi, 'tích phân của'],
  [/∫/gi, 'tích phân của'],
  [/\\Delta\s*x\b|Δx/gi, 'đen-ta x'],
  [/\\Delta\b|Δ/gi, 'đen-ta'],
  [/\\lim_\{([^}]+)\}/gi, 'giới hạn khi $1'],
  [/\blim\b/gi, 'giới hạn'],
  [/\\sum_\{([^}]+)\}\^\{([^}]+)\}/gi, 'tổng từ $1 đến $2 của'],
  [/\\sum\b|∑/gi, 'tổng'],

  // Subscripts & iteration indices
  [/\bw_\{t\s*\+\s*1\}/gi, 'w tại bước t cộng một'],
  [/\bw_\{t\}/gi, 'w tại bước t'],
  [/\bw_t\b/gi, 'w tại bước t'],
  [/\bw_1\b/gi, 'w một'],
  [/\bw_2\b/gi, 'w hai'],
  [/\bw_i\b/gi, 'w i'],
  [/\bx_1\b/gi, 'x một'],
  [/\bx_2\b/gi, 'x hai'],
  [/\bx_i\b/gi, 'x i'],
  [/\by_i\b/gi, 'y i'],

  // Powers
  [/\b([a-zA-Z0-9]+)\^2\b/g, '$1 bình phương'],
  [/\b([a-zA-Z0-9]+)²\b/g, '$1 bình phương'],
  [/\b([a-zA-Z0-9]+)\^3\b/g, '$1 lập phương'],
  [/\b([a-zA-Z0-9]+)³\b/g, '$1 lập phương'],
  [/\b([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\b/g, '$1 mũ $2'],
  [/\b([a-zA-Z0-9]+)\^\{([^}]+)\}\b/g, '$1 mũ $2'],

  // Greek letters commonly used in math/AI
  [/\\alpha\b|α/gi, 'an-pha'],
  [/\\beta\b|β/gi, 'bê-ta'],
  [/\\theta\b|θ/gi, 'thê-ta'],
  [/\\eta\b|η/gi, 'ê-ta'],
  [/\\pi\b|π/gi, 'pi'],
  [/\\lambda\b|λ/gi, 'lam-đa'],
  [/\\sigma\b|σ/gi, 'xích-ma'],

  // LaTeX fractions: \frac{a}{b} -> a phần b
  [/\\frac\{([^}]+)\}\{([^}]+)\}/gi, '$1 phần $2'],

  // Operators & Comparison
  [/\\times\b|\\cdot\b|×/gi, 'nhân'],
  [/\\div\b|÷/gi, 'chia'],
  [/\\pm\b|±/gi, 'cộng trừ'],
  [/\\approx\b|≈/gi, 'xấp xỉ'],
  [/\\neq\b|!=|≠/gi, 'khác'],
  [/\\le\b|<=|≤/gi, 'nhỏ hơn hoặc bằng'],
  [/\\ge\b|>=|≥/gi, 'lớn hơn hoặc bằng'],
  [/\\in\b|∈/gi, 'thuộc'],
  [/\\notin\b|∉/gi, 'không thuộc'],
  [/\\to\b|\\rightarrow\b|→/gi, 'tiến tới'],
  [/<=/g, 'nhỏ hơn hoặc bằng'],
  [/>=/g, 'lớn hơn hoặc bằng'],
  [/==/g, 'bằng'],
  [/=/g, 'bằng']
];

export function normalizeVietnameseNarration(
  input: string,
  options: VietnameseNormalizationOptions = {}
): VietnameseNormalizationResult {
  if (!input || !input.trim()) {
    return {
      normalizedText: '',
      unsupportedTokens: [],
      wordCount: 0,
      estimatedDurationSeconds: 0
    };
  }

  let text = input.trim();

  // 1. Apply user custom pronunciation hints first
  if (options.pronunciationHints && options.pronunciationHints.length > 0) {
    for (const hint of options.pronunciationHints) {
      if (hint.written && hint.spoken) {
        text = text.split(hint.written).join(hint.spoken);
      }
    }
  }

  // 2. Normalize AI / ML terms
  for (const [pattern, replacement] of AI_TERMINOLOGY_RULES) {
    text = text.replace(pattern, replacement);
  }

  // 3. Normalize Mathematical expressions & LaTeX
  for (const [pattern, replacement] of MATH_EXPRESSION_RULES) {
    text = text.replace(pattern, replacement);
  }

  // 4. Handle percentage: 95% -> chín mươi lăm phần trăm
  text = text.replace(/(\d+)%/g, (_, num) => {
    return `${integerToVietnamese(Number(num))} phần trăm`;
  });

  // 5. Handle decimals: 0.01 -> không phẩy không một
  text = text.replace(/(\d+)\.(\d+)/g, (_, intPart, decPart) => {
    const intWord = integerToVietnamese(Number(intPart));
    const decWord = digitSequenceToVietnamese(decPart);
    return `${intWord} phẩy ${decWord}`;
  });

  // 6. Handle negative numbers: -5 -> âm năm
  text = text.replace(/(^|[\s(])-(?=\d)/g, '$1âm ');

  // 7. Handle remaining individual arithmetic signs safely in math contexts
  // e.g. "a + b" -> "a cộng b"
  text = text.replace(/([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+)\s*\+\s*([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+)/g, '$1 cộng $2');
  // e.g. "a - b" -> "a trừ b" (avoiding hyphens in compound words like pơ-sép-tròn, an-pha)
  text = text.replace(/(?<=[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9])\s+-\s+(?=[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9])/g, ' trừ ');
  // e.g. "a * b" -> "a nhân b"
  text = text.replace(/([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+)\s*\*\s*([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+)/g, '$1 nhân $2');
  // e.g. "a / b" -> "a chia b"
  text = text.replace(/(?<=[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9])\s*\/\s*(?=[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9])/g, ' chia ');

  // 8. Detect unsupported LaTeX tokens (e.g. \unknownCommand)
  const unsupportedTokens: string[] = [];
  const latexCommandRegex = /\\[a-zA-Z]+/g;
  let match: RegExpExecArray | null;
  while ((match = latexCommandRegex.exec(text)) !== null) {
    if (!unsupportedTokens.includes(match[0])) {
      unsupportedTokens.push(match[0]);
    }
  }

  // If allowPassThroughUnknownLatex is not true, strip the backslash to prevent engine crash
  if (!options.allowPassThroughUnknownLatex) {
    text = text.replace(/\\([a-zA-Z]+)/g, '$1');
  }

  // 9. Natural pause & punctuation cadence
  // Normalize whitespace, spaces before commas/periods, and multiple punctuation
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;?!])/g, '$1')
    .replace(/([,.:;?!])(?=[^\s\d])/g, '$1 ')
    .trim();

  // 10. Compute word count and estimated duration
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  // Natural Vietnamese speech rate is ~3.2 to 3.5 words/syllables per second
  const wps = options.wordsPerSecond ?? 3.2;
  const estimatedDurationSeconds = Math.max(1, Math.round((wordCount / wps) * 10) / 10);

  return {
    normalizedText: text,
    unsupportedTokens,
    wordCount,
    estimatedDurationSeconds
  };
}
