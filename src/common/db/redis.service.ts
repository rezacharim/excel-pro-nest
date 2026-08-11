import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * One-time-code (OTP) store backed by Postgres.
 *
 * This used to be backed by an Upstash Redis instance owned by a third
 * party. It now stores codes in the project's own database (table
 * "otp_codes", created by migration.sql) so no external Redis service is
 * required. The class keeps its original name and interface so no other
 * code needed to change.
 */
@Injectable()
export class RedisService {
  constructor(private readonly dataSource: DataSource) {}

  async setOTP(key: string, otp: string, ttlSeconds: number = 120) {
    await this.dataSource.query(
      `INSERT INTO otp_codes ("key", "code", "expires_at")
       VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)
       ON CONFLICT ("key")
       DO UPDATE SET "code" = $2, "expires_at" = NOW() + ($3 || ' seconds')::interval`,
      [key, otp, String(ttlSeconds)],
    );
  }

  async getOTP(key: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT "code" FROM otp_codes WHERE "key" = $1 AND "expires_at" > NOW()`,
      [key],
    );
    return rows.length ? rows[0].code : null;
  }

  async deleteOTP(key: string) {
    await this.dataSource.query(`DELETE FROM otp_codes WHERE "key" = $1`, [
      key,
    ]);
  }
}
