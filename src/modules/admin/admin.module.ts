import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../auth/entities/admin.entity';
import { ActivityModule } from '../activity/activity.module';

@Module({
  // ActivityModule is @Global, but importing it here keeps the audit trail
  // working regardless of the order modules are registered in app.module.
  imports: [TypeOrmModule.forFeature([Admin]), ActivityModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
