/**
 * Low-level LLM abstraction. An `LlmProvider` knows only how to turn a
 * (system, prompt) pair into text — optionally strict JSON. All agent logic
 * (planning prompts, arg-schema hints, parsing, deferred-arg resolution) lives
 * once in `LlmRuntime`, so adding a provider means implementing just `generate`.
 */
export interface LlmGenerateRequest {
  /** System instruction / role framing. */
  system: string;
  /** User content. */
  prompt: string;
  temperature: number;
  /** Request strict JSON output (the returned string is then JSON-parseable). */
  json: boolean;
}

export interface LlmProvider {
  /** Provider identifier, surfaced as the runtime's `mode` (e.g. 'gemini'). */
  readonly name: string;
  generate(req: LlmGenerateRequest): Promise<string>;
}
