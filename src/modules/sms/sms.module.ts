import { Module } from '@nestjs/common';
import { TwilioService } from './sms.service';

@Module({
  providers: [TwilioService],
  exports: [TwilioService],
})
export class SmsModule {}
