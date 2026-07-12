import OpenAI from 'openai';
import { getServerEnv } from '@nexus/shared';
import type { LlmGenerateRequest, LlmProvider } from '../provider.js';

/**
 * OpenAI provider (Chat Completions). Model is configured via OPENAI_MODEL.
 * JSON mode uses response_format: json_object, supported by the gpt-4.1 / gpt-5
 * families. Note: some reasoning models reject a custom temperature — set
 * OPENAI_MODEL accordingly.
 */
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const env = getServerEnv();
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is required when AI_PROVIDER=openai and not in demo mode. ' +
          'Set NEXT_PUBLIC_IS_DEMO_MODE=true for keyless operation.',
      );
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_MODEL;
  }

  async generate(req: LlmGenerateRequest): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: req.temperature,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
      ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
    });
    return completion.choices[0]?.message.content ?? (req.json ? '{}' : '');
  }
}
