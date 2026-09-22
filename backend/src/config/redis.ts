import Redis from 'ioredis';
import { config } from './index';

let isRedisUp = false;

// Safe Redis client with lazy connection and silent fallback when offline
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  connectTimeout: 800,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: () => null, // Do not spam reconnects if Redis is not running
});

// Suppress unhandled error events
redisClient.on('error', () => {});

// Attempt non-blocking connection check
redisClient
  .connect()
  .then(() => {
    isRedisUp = true;
    console.log('[Redis] Connected successfully');
  })
  .catch(() => {
    isRedisUp = false;
  });

// Smart proxy: routes to Redis when available, otherwise safely fails open
const redis = new Proxy(redisClient, {
  get(target, prop: string) {
    if (prop === 'status') {
      return isRedisUp ? target.status : 'offline';
    }
    if (typeof (target as any)[prop] === 'function') {
      return (...args: any[]) => {
        if (!isRedisUp) {
          if (prop === 'incr') return Promise.resolve(1);
          if (prop === 'expire' || prop === 'ttl') return Promise.resolve(1);
          return Promise.resolve(null);
        }
        return (target as any)[prop](...args);
      };
    }
    return (target as any)[prop];
  },
});

export default redis;
