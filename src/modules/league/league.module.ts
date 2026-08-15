import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { LeagueSeason } from './entities/league-season.entity';
import { LeagueRegistration } from './entities/league-registration.entity';
import { TrialBooking } from './entities/trial-booking.entity';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { LeagueService } from './league.service';
import { LeagueExportService } from './league-export.service';
import {
  LeagueAdminController,
  LeaguePortalController,
  LeaguePublicController,
} from './league.controller';
import { PortalGuard } from '../portal/portal.guard';
import { EXCEL_PRO_JWT } from '../../common/constant/jwt.const';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeagueSeason,
      LeagueRegistration,
      TrialBooking,
      User,
      Payment,
    ]),
    // Same secret the parent portal signs its tokens with, so a parent's
    // existing dashboard session works on the league routes too.
    JwtModule.register({
      secret: EXCEL_PRO_JWT,
      signOptions: { expiresIn: '2d' },
    }),
  ],
  controllers: [
    LeaguePublicController,
    LeaguePortalController,
    LeagueAdminController,
  ],
  providers: [LeagueService, LeagueExportService, PortalGuard],
  exports: [LeagueService],
})
export class LeagueModule {}
