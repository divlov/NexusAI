import { GoogleGenAI } from '@google/genai';
import { getServerEnv } from '@nexus/shared';
import type { LlmGenerateRequest, LlmProvider } from '../provider.js';

/**
 * Google Gemini provider. Model is configured via GEMINI_MODEL (defaults to
 * gemini-3.1-flash-lite in env config). JSON mode uses responseMimeType.
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor() {
    const env = getServerEnv();
    if (!env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY is required when AI_PROVIDER=gemini and not in demo mode. ' +
          'Set NEXT_PUBLIC_IS_DEMO_MODE=true for keyless operation.',
      );
    }
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.model = env.GEMINI_MODEL;
  }

  async generate(req: LlmGenerateRequest): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: req.prompt,
      config: {
        temperature: req.temperature,
        systemInstruction: req.system,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    return response.text ?? (req.json ? '{}' : '');
  }
}
