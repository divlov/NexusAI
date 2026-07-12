import { IS_DEMO_MODE } from '@nexus/shared';
import { DemoRuntime } from './demo.js';
import { GeminiRuntime } from './gemini.js';
import type { AgentRuntime } from './types.js';
import type { ToolContext } from '../tools/context.js';

/**
 * Single decision point for real-vs-demo execution. Everything downstream
 * (graph, worker) depends only on the AgentRuntime interface.
 *
 * `ctx` carries the tenant identity + credential resolver for real tool
 * execution. It is undefined in demo mode (DemoRuntime never touches it).
 */
export function createAgentRuntime(
  ctx?: ToolContext,
  isDemo: boolean = IS_DEMO_MODE,
): AgentRuntime {
  return isDemo ? new DemoRuntime() : new GeminiRuntime(ctx);
}
