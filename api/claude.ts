import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { APIConnectionTimeoutError, APIError, NotFoundError, PermissionDeniedError, RateLimitError } from '@anthropic-ai/sdk';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const DEFAULT_MODELS = 'anthropic.claude-opus-5,anthropic.claude-sonnet-5';
// API Gateway cuts requests off at 30s, so the whole model chain must finish well inside that.
const TIME_BUDGET_MS = 24_000;
const MIN_ATTEMPT_MS = 3_000;
const UNAVAILABLE_RETRY_MS = 10 * 60_000;

// Models that returned 403/404 are skipped for a while, so enabling access in Bedrock takes effect without a redeploy.
const unavailableUntil = new Map<string, number>();
let client: AnthropicBedrockMantle | undefined;

export type ClaudeOutcome<T> = { ok: true; value: T; model: string } | { ok: false; reason: string };

export interface JsonTool<T> {
  name: string;
  description: string;
  schema: z.ZodType<T>;
}

export function aiEnabled(): boolean {
  return process.env.AI_PROVIDER === 'bedrock';
}

export function modelChain(): string[] {
  return (process.env.BEDROCK_MODELS || DEFAULT_MODELS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

function bedrock(): AnthropicBedrockMantle {
  client ??= new AnthropicBedrockMantle({ awsRegion: process.env.BEDROCK_REGION || process.env.AWS_REGION, maxRetries: 0 });
  return client;
}

function describeFailure(model: string, err: unknown): string {
  if (err instanceof PermissionDeniedError || err instanceof NotFoundError) {
    unavailableUntil.set(model, Date.now() + UNAVAILABLE_RETRY_MS);
    return `${model} is not available to this AWS account (${err.status})`;
  }
  if (err instanceof RateLimitError) return `${model} is rate limited`;
  if (err instanceof APIConnectionTimeoutError) return `${model} timed out`;
  if (err instanceof APIError) {
    const body = err.error as { error?: { message?: string } } | undefined;
    return `${model} returned ${err.status ?? 'an error'}: ${body?.error?.message ?? err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function withModelChain<T>(attempt: (model: string, timeout: number) => Promise<T | null>): Promise<ClaudeOutcome<T>> {
  if (!aiEnabled()) return { ok: false, reason: 'Claude is not configured in this environment' };
  const deadline = Date.now() + TIME_BUDGET_MS;
  let reason = 'No Claude model is available';
  for (const model of modelChain()) {
    if ((unavailableUntil.get(model) ?? 0) > Date.now()) continue;
    const timeout = deadline - Date.now();
    if (timeout < MIN_ATTEMPT_MS) {
      reason = 'Claude took too long to respond';
      break;
    }
    try {
      const value = await attempt(model, timeout);
      if (value !== null) return { ok: true, value, model };
      reason = `${model} did not return a usable answer`;
    } catch (err) {
      reason = describeFailure(model, err);
    }
    console.warn('Claude attempt failed', { model, reason });
  }
  return { ok: false, reason };
}

export function askClaudeText(system: string, messages: Anthropic.MessageParam[], maxTokens = 2_000) {
  return withModelChain(async (model, timeout) => {
    const res = await bedrock().messages.create(
      { model, max_tokens: maxTokens, system, messages, output_config: { effort: 'low' } },
      { timeout },
    );
    if (res.stop_reason === 'refusal') return null;
    const text = res.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim();
    return text || null;
  });
}

// Structured outputs aren't offered on Claude in Amazon Bedrock, so JSON comes back as a
// tool call and is validated with the same zod schema that generated the tool definition.
export function askClaudeJson<T>(system: string, prompt: string, tool: JsonTool<T>, maxTokens = 3_000) {
  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.schema) as Record<string, unknown>;
  return withModelChain(async (model, timeout) => {
    const res = await bedrock().messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ name: tool.name, description: tool.description, input_schema: inputSchema as Anthropic.Tool.InputSchema }],
        tool_choice: { type: 'auto' },
        output_config: { effort: 'low' },
      },
      { timeout },
    );
    if (res.stop_reason === 'refusal') return null;
    for (const block of res.content) {
      if (block.type === 'tool_use' && block.name === tool.name) {
        const parsed = tool.schema.safeParse(block.input);
        if (parsed.success) return parsed.data;
        console.warn('Claude tool input failed validation', { model, issues: parsed.error.issues.slice(0, 3) });
      }
    }
    return null;
  });
}
