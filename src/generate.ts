import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
export const CLAUDE_MODEL_DISPLAY = 'Claude Haiku 4.5';
const MAX_DIFF_CHARS = 8000;

export function buildPrompt(diff: string, recentCommits: string): string {
  const styleSection = recentCommits
    ? `Recent commit messages in this repo (for style reference):\n${recentCommits}\n\n`
    : '';

  const truncatedDiff = diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + '\n... (diff truncated)'
    : diff;

  return (
    `You are a developer writing a Git commit message.\n\n` +
    styleSection +
    `Staged diff:\n${truncatedDiff}\n\n` +
    `Write a single commit message for the above changes. Match the style and format of the recent commits. Output only the commit message, nothing else.`
  );
}

export async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== 'text') {
    throw new Error('Unexpected response type from Claude.');
  }
  return block.text.trim();
}
