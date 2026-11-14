import type { HermesClient } from './client.ts';

export function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const suffix = '…';
  const cut = text.slice(0, Math.max(0, maxChars - suffix.length));
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()}${suffix}`;
}

export async function shortenForWatch(message: string, maxChars: number, client: HermesClient): Promise<{ message: string; capped: boolean }> {
  if (message.length <= maxChars) return { message, capped: false };
  const compressed = await client.chat(`Rewrite the following notification in at most 15 words. No preamble. No quotes.\n\n${message}`);
  return { message: truncateAtWordBoundary(compressed, maxChars), capped: true };
}
