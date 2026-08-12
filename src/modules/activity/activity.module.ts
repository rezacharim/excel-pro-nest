import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminActivity } from './entities/admin-activity.entity';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { ActivityInterceptor } from './activity.interceptor';

/**
 * Global so any module can record an admin action without extra wiring.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminActivity])],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityInterceptor],
  exports: [ActivityService, ActivityInterceptor],
})
export class ActivityModule {}
