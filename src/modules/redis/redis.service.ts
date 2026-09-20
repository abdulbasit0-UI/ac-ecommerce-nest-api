import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly defaultTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    config: ConfigService,
  ) {
    this.defaultTtl = config.get<number>('cacheTtlSeconds') ?? 60;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = this.defaultTtl): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
    const keys: string[] = [];
    for await (const chunk of stream) {
      keys.push(...(chunk as string[]));
    }
    if (keys.length) {
      await this.client.del(...keys);
    }
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }
}
