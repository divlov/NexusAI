import { getServerEnv, IS_DEMO_MODE } from '@nexus/shared';
import { DemoRuntime } from './demo.js';
import { LlmRuntime } from './llmRuntime.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAIProvider } from './providers/openai.js';
import type { AgentRuntime } from './types.js';
import type { LlmProvider } from './provider.js';
import type { ToolContext } from '../tools/context.js';

/**
 * Single decision point for real-vs-demo execution and provider selection.
 * Everything downstream (graph, worker) depends only on the AgentRuntime
 * interface — it never knows which LLM provider is behind it.
 *
 * `ctx` carries the tenant identity + credential resolver for real tool
 * execution. It is undefined in demo mode (DemoRuntime never touches it).
 */
export function createAgentRuntime(
  ctx?: ToolContext,
  isDemo: boolean = IS_DEMO_MODE,
): AgentRuntime {
  if (isDemo) return new DemoRuntime();
  return new LlmRuntime(selectProvider(), ctx);
}

/** Pick the LLM provider from AI_PROVIDER (defaults to Gemini). */
function selectProvider(): LlmProvider {
  return getServerEnv().AI_PROVIDER === 'openai'
    ? new OpenAIProvider()
    : new GeminiProvider();
}
