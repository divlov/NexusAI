import { Redis, type RedisOptions } from 'ioredis';
import { getServerEnv } from '../env.js';

/**
 * Shared Redis connection factory used by the BullMQ producer (web) and worker.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on the connection it owns; we
 * apply that here so both sides are configured identically.
 */

export function redisConnectionOptions(): RedisOptions {
  const url = new URL(getServerEnv().REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/** Create a fresh ioredis client (e.g. for pub/sub, which needs dedicated conns). */
export function createRedisClient(): Redis {
  return new Redis(redisConnectionOptions());
}
