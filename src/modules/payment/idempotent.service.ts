import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from '../payment/entities/idempotent-request.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
  ) {}

  /**
   * مقدار جدید idempotency key را ایجاد می‌کند
   */
  generateKey(): string {
    return uuid();
  }

  /**
   * بررسی می‌کند که آیا عملیات با کلید idempotency داده شده قبلاً پردازش شده است یا خیر
   */
  async findProcessedOperation(
    key: string,
    operation: string,
  ): Promise<IdempotencyKey | null> {
    try {
      return await this.idempotencyRepository.findOne({
        where: {
          key,
          operation,
          isProcessed: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error finding processed operation with key ${key}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * ذخیره نتیجه عملیات با کلید idempotency
   */
  async saveProcessedOperation(
    key: string,
    operation: string,
    responseData: any,
  ): Promise<IdempotencyKey> {
    try {
      // ابتدا بررسی کنید که آیا کلید از قبل وجود دارد
      let record = await this.idempotencyRepository.findOne({
        where: { key, operation },
      });

      if (record) {
        // اگر از قبل وجود داشته باشد، آن را به‌روزرسانی کنید
        record.responseData = responseData;
        record.isProcessed = true;
        return await this.idempotencyRepository.save(record);
      } else {
        // ایجاد یک رکورد جدید
        record = this.idempotencyRepository.create({
          key,
          operation,
          responseData,
          isProcessed: true,
        });
        return await this.idempotencyRepository.save(record);
      }
    } catch (error) {
      this.logger.error(
        `Error saving processed operation with key ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * ثبت اولیه کلید idempotency قبل از شروع پردازش
   */
  async registerKey(key: string, operation: string): Promise<IdempotencyKey> {
    try {
      const record = this.idempotencyRepository.create({
        key,
        operation,
        isProcessed: false,
      });
      return await this.idempotencyRepository.save(record);
    } catch (error) {
      this.logger.error(
        `Error registering key ${key} for operation ${operation}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * پاک کردن کلیدهای قدیمی برای نگهداری
   */
  async cleanupOldKeys(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await this.idempotencyRepository.delete({
        createdAt: cutoffDate,
      });
    } catch (error) {
      this.logger.error(`Error cleaning up old keys: ${error.message}`);
    }
  }
}
