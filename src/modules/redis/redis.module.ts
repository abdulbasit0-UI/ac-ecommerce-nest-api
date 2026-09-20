import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('redisHost'),
          port: config.get<number>('redisPort'),
          password: config.get<string>('redisPassword') || undefined,
          maxRetriesPerRequest: 2,
          lazyConnect: false,
        }),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
