import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { LeagueModule } from '../league/league.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Payment]), LeagueModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
