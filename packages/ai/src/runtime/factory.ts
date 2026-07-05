import { IS_DEMO_MODE } from '@nexus/shared';
import { DemoRuntime } from './demo.js';
import { GeminiRuntime } from './gemini.js';
import type { AgentRuntime } from './types.js';

/**
 * Single decision point for real-vs-demo execution. Everything downstream
 * (graph, worker) depends only on the AgentRuntime interface.
 */
export function createAgentRuntime(isDemo: boolean = IS_DEMO_MODE): AgentRuntime {
  return isDemo ? new DemoRuntime() : new GeminiRuntime();
}
