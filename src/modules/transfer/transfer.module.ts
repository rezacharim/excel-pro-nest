import { Module } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { TwilioService } from '../sms/sms.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transfer } from './entities/transfer.entity';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notificationsService.service';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, User, Payment]),
    ScheduleModule.forRoot(),
    ConfigModule,
    MembershipModule,
  ],
  controllers: [TransferController],
  providers: [TransferService, TwilioService, NotificationsService],
})
export class TransferModule {}
