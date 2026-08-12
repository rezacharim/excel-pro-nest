import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RedisService } from 'src/common/db/redis.service';
import { TwilioService } from '../sms/sms.service';
import { EXCEL_PRO_JWT } from '../../common/constant/jwt.const';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: EXCEL_PRO_JWT,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, RedisService, TwilioService],
  exports: [UsersService],
})
export class UsersModule {}
