import type { Config } from '../config.ts';
import { NoopPushSender } from './noop.ts';
import type { PushSender } from './types.ts';
export function createPushSender(config: Pick<Config, 'pushSender'>): PushSender { if (config.pushSender === 'noop') return new NoopPushSender(); throw new Error('Unsupported push sender'); }
