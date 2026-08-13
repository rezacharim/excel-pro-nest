import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

export interface AcademySettings {
  /** Membership price for a 2-month cycle, CAD */
  membershipPrice: number;
  /** One-time registration fee for brand-new players, CAD */
  firstTimeFee: number;
  /** Interac e-transfer address parents send money to */
  etransferEmail: string;
  /** Days before the renewal date the first reminder goes out */
  reminderDaysBefore: number;
  /** Turn automatic suspension of unpaid accounts on/off */
  autoSuspendEnabled: boolean;
  /** Days overdue before an unpaid account is auto-suspended */
  autoSuspendDays: number;
  /**
   * Master switch for the automatic emails that go OUT to families on a
   * schedule (renewal reminders and overdue notices).
   *
   * It does NOT affect emails a person asked for: sign-in codes, payment
   * instructions, receipts, or a reminder an admin sends by hand from the
   * Collections screen. Those must keep working at all times.
   */
  remindersPaused: boolean;
}

export const DEFAULT_SETTINGS: AcademySettings = {
  membershipPrice: 380,
  firstTimeFee: 75,
  etransferEmail: 'Excelpro.Etransfer@gmail.com',
  reminderDaysBefore: 3,
  // Off by default: the academy chases by email and decides suspensions itself.
  autoSuspendEnabled: false,
  autoSuspendDays: 7,
  // Starts PAUSED so no family is emailed automatically while the academy is
  // still correcting old records. The owner switches it on when ready.
  remindersPaused: true,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  async getAll(): Promise<AcademySettings> {
    try {
      const rows = await this.repo.find();
      const stored = new Map(rows.map((r) => [r.key, r.value]));
      const num = (key: keyof AcademySettings, fallback: number) => {
        const raw = stored.get(key);
        const parsed = raw === undefined || raw === null ? NaN : Number(raw);
        return isNaN(parsed) ? fallback : parsed;
      };
      return {
        membershipPrice: num('membershipPrice', DEFAULT_SETTINGS.membershipPrice),
        firstTimeFee: num('firstTimeFee', DEFAULT_SETTINGS.firstTimeFee),
        etransferEmail:
          stored.get('etransferEmail') || DEFAULT_SETTINGS.etransferEmail,
        reminderDaysBefore: num(
          'reminderDaysBefore',
          DEFAULT_SETTINGS.reminderDaysBefore,
        ),
        autoSuspendEnabled:
          (stored.get('autoSuspendEnabled') ??
            String(DEFAULT_SETTINGS.autoSuspendEnabled)) === 'true',
        autoSuspendDays: num('autoSuspendDays', DEFAULT_SETTINGS.autoSuspendDays),
        remindersPaused:
          (stored.get('remindersPaused') ??
            String(DEFAULT_SETTINGS.remindersPaused)) === 'true',
      };
    } catch (error) {
      // Table missing (migration not run yet) must not break the API.
      this.logger.warn(`Settings unavailable, using defaults: ${error.message}`);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async update(patch: Partial<AcademySettings>): Promise<AcademySettings> {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    for (const [key, value] of entries) {
      await this.repo.save(this.repo.create({ key, value: String(value) }));
    }
    return this.getAll();
  }
}
