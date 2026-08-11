import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url');
    this.client = new Redis(redisUrl);
  }

  async setOTP(key: string, otp: string, ttlSeconds: number = 120) {
    await this.client.set(key, otp, 'EX', ttlSeconds);
  }

  async getOTP(key: string) {
    return this.client.get(key);
  }

  async deleteOTP(key: string) {
    return this.client.del(key);
  }
}
