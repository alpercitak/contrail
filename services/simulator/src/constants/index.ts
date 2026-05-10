import { REDIS_DEFAULT_URL } from '@contrail/shared/constants';

export const FLEET_SIZE = Number.parseInt(process.env.FLEET_SIZE ?? '150');
export const TICK_MS = Number.parseInt(process.env.TICK_MS ?? '5000');
export const REDIS_URL = process.env.REDIS_URL ?? REDIS_DEFAULT_URL;
