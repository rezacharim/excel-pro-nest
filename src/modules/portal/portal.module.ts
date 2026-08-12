import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { PortalGuard } from './portal.guard';
import { PortalRequest } from './entities/portal-request.entity';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Transfer } from '../transfer/entities/transfer.entity';
import { RedisService } from '../../common/db/redis.service';
import { EXCEL_PRO_JWT } from '../../common/constant/jwt.const';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, PortalRequest, Transfer]),
    JwtModule.register({
      secret: EXCEL_PRO_JWT,
      signOptions: { expiresIn: '2d' },
    }),
  ],
  controllers: [PortalController],
  providers: [PortalService, PortalGuard, RedisService],
})
export class PortalModule {}
