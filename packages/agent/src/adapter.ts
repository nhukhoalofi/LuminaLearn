import { GoogleGenAI } from '@google/genai';

export interface StructuredGenerationRequest { purpose: 'lesson_plan' | 'visual_storyboard'; prompt: string; jsonSchema: unknown; }
export interface GeminiAdapter { generateStructured(request: StructuredGenerationRequest): Promise<unknown>; }
export interface LiveGeminiAdapterOptions { apiKey?: string; model?: string; timeoutMs?: number; maxRetries?: number; }

export class LiveGeminiAdapter implements GeminiAdapter {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly maxRetries: number;

  constructor(options: LiveGeminiAdapterOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for live Gemini mode');
    this.model = options.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
    this.maxRetries = options.maxRetries ?? 2;
    this.client = new GoogleGenAI({ apiKey, httpOptions: { timeout: options.timeoutMs ?? Number(process.env.GEMINI_TIMEOUT_MS || '60000') } });
  }

  async generateStructured(request: StructuredGenerationRequest): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.models.generateContent({
          model: this.model, contents: request.prompt,
          config: { temperature: 0.2, responseMimeType: 'application/json', responseJsonSchema: request.jsonSchema }
        });
        if (!response.text) throw new Error('Gemini returned an empty structured response');
        return JSON.parse(response.text);
      } catch (error) { lastError = error; if (attempt === this.maxRetries) break; }
    }
    throw new Error(`Gemini structured generation failed after ${this.maxRetries + 1} attempt(s)`, { cause: lastError });
  }
}

