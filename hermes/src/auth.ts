import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

export function hasBearerToken(request: FastifyRequest, expected: string): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const token = Buffer.from(expected);
  return actual.length === token.length && timingSafeEqual(actual, token);
}
