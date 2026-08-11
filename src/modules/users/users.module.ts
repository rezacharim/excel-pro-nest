import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RedisService } from 'src/common/db/redis.service';
import { TwilioService } from '../sms/sms.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, RedisService, TwilioService],
  exports: [UsersService],
})
export class UsersModule {}
