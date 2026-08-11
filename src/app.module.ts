import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { pool } from './common/db/postgresql.config';
import redisConfig from './common/db/redis.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MatchesModule } from './modules/matches/matches.module';
import { PlayerMonthModule } from './modules/player_month/player_month.module';
import { AdminModule } from './modules/admin/admin.module';
import { SmsModule } from './modules/sms/sms.module';
import { MessagesModule } from './modules/messages/messages.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import * as dotenv from 'dotenv';
import { JwtModule } from '@nestjs/jwt';
import { TransferModule } from './modules/transfer/transfer.module';
import { MailModule } from './modules/mail/mail.module';
import { MembershipModule } from './modules/membership/membership.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';

dotenv.config({ path: '.env.local' });
@Module({
  imports: [
    TypeOrmModule.forRoot(pool),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
      load: [redisConfig],
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '2d' },
    }),
    PaymentModule.forRootAsync(),
    PassportModule,
    AuthModule,
    UsersModule,
    ProgramsModule,
    PaymentModule,
    MatchesModule,
    AdminModule,
    SmsModule,
    MessagesModule,
    GalleryModule,
    PlayerMonthModule,
    TransferModule,
    MailModule,
    MembershipModule,
    AnnouncementsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
