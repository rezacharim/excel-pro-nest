import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActivity } from './entities/admin-activity.entity';

export interface ActivityActor {
  id?: number | null;
  username?: string | null;
}

export interface LogActivityInput {
  action: string;
  targetType?: string;
  targetId?: number | null;
  targetName?: string | null;
  details?: string | null;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(AdminActivity)
    private readonly repo: Repository<AdminActivity>,
  ) {}

  /**
   * Record an admin action. Never throws — an audit-trail failure must not
   * break the action the admin was actually performing.
   */
  async log(actor: ActivityActor | null, input: LogActivityInput) {
    try {
      await this.repo.save(
        this.repo.create({
          adminId: actor?.id ?? null,
          adminUsername: actor?.username || 'system',
          action: input.action,
          targetType: input.targetType || 'member',
          targetId: input.targetId ?? null,
          targetName: input.targetName ?? null,
          details: input.details ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(`Activity log failed: ${error.message}`);
    }
  }

  async list(options: {
    limit?: number;
    offset?: number;
    adminUsername?: string;
    action?: string;
    targetId?: number;
  }): Promise<{ total: number; items: AdminActivity[] }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const query = this.repo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .take(limit)
      .skip(offset);

    if (options.adminUsername) {
      query.andWhere('a.adminUsername = :u', { u: options.adminUsername });
    }
    if (options.action) {
      query.andWhere('a.action LIKE :a', { a: `${options.action}%` });
    }
    if (options.targetId) {
      query.andWhere('a.targetId = :t', { t: options.targetId });
    }

    const [items, total] = await query.getManyAndCount();
    return { total, items };
  }

  /** Distinct admin usernames that appear in the log, for the filter dropdown. */
  async actors(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.adminUsername', 'username')
      .orderBy('a.adminUsername', 'ASC')
      .getRawMany();
    return rows.map((r) => r.username).filter(Boolean);
  }
}
