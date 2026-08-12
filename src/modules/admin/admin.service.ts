import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from '../auth/entities/admin.entity';
import { hashPassword } from '../../common/utils/crypto/passwordHash';
import { ActivityActor, ActivityService } from '../activity/activity.service';
import {
  ADMIN_MIN_PASSWORD_LENGTH,
  CreateAdminDto,
} from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

/** Everything about an admin that is safe to send to the dashboard. */
export interface PublicAdmin {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  account_status: string;
  last_login: Date;
  createdAt: Date;
}

const PUBLIC_FIELDS: (keyof Admin)[] = [
  'id',
  'username',
  'email',
  'first_name',
  'last_name',
  'account_status',
  'last_login',
  'createdAt',
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly activityService: ActivityService,
  ) {}

  /** Strips the password hash. Every response goes through here. */
  private toPublic(admin: Admin): PublicAdmin {
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      first_name: admin.first_name,
      last_name: admin.last_name,
      account_status: admin.account_status,
      last_login: admin.last_login,
      createdAt: admin.createdAt,
    };
  }

  private displayName(admin: Admin | PublicAdmin): string {
    return `${admin.first_name} ${admin.last_name}`.trim() || admin.username;
  }

  /** Loads the full row (password included) for internal use only. */
  private async findEntity(id: number): Promise<Admin> {
    const admin = await this.adminRepository.findOneBy({ id });
    if (!admin) {
      throw new NotFoundException(`Admin with id ${id} not found`);
    }
    return admin;
  }

  /**
   * Case-insensitive uniqueness check: 'Director' and 'director' are the same
   * person as far as anybody reading the dashboard is concerned.
   */
  private async findByField(
    field: 'username' | 'email',
    value: string,
    excludeId?: number,
  ): Promise<Admin | null> {
    const query = this.adminRepository
      .createQueryBuilder('admin')
      .where(`LOWER(admin.${field}) = LOWER(:value)`, { value });

    if (excludeId !== undefined) {
      query.andWhere('admin.id != :excludeId', { excludeId });
    }

    return query.getOne();
  }

  /** Number of admins who could still sign in if `excludeId` disappeared. */
  private async countOtherActiveAdmins(excludeId: number): Promise<number> {
    return this.adminRepository.count({
      where: { account_status: 'active', id: Not(excludeId) },
    });
  }

  async findAll(): Promise<PublicAdmin[]> {
    const admins = await this.adminRepository.find({
      select: PUBLIC_FIELDS,
      order: { id: 'ASC' },
    });
    return admins.map((admin) => this.toPublic(admin));
  }

  async findOne(id: number): Promise<PublicAdmin> {
    return this.toPublic(await this.findEntity(id));
  }

  async create(
    dto: CreateAdminDto,
    actor: ActivityActor,
  ): Promise<PublicAdmin> {
    const { username, email, first_name, last_name, password } = dto;

    if (!password || password.length < ADMIN_MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters long`,
      );
    }

    if (await this.findByField('username', username)) {
      throw new ConflictException(
        `The username "${username}" is already taken by another admin`,
      );
    }
    if (await this.findByField('email', email)) {
      throw new ConflictException(
        `The email "${email}" is already used by another admin`,
      );
    }

    const admin = await this.adminRepository.save(
      this.adminRepository.create({
        username,
        email,
        first_name,
        last_name,
        password: await hashPassword(password),
        account_status: 'active',
        failed_attempts: 0,
      }),
    );

    this.logger.log(`Admin created: id=${admin.id}`);

    await this.activityService.log(actor, {
      action: 'admin.create',
      targetType: 'admin',
      targetId: admin.id,
      targetName: this.displayName(admin),
      details: `Created admin account "${admin.username}" (${admin.email})`,
    });

    return this.toPublic(admin);
  }

  async update(
    id: number,
    dto: UpdateAdminDto,
    actor: ActivityActor,
  ): Promise<PublicAdmin> {
    const fields = Object.keys(dto).filter((key) => dto[key] !== undefined);
    if (fields.length === 0) {
      throw new BadRequestException('No update data provided');
    }

    const admin = await this.findEntity(id);

    if (
      dto.email !== undefined &&
      (await this.findByField('email', dto.email, id))
    ) {
      throw new ConflictException(
        `The email "${dto.email}" is already used by another admin`,
      );
    }

    // Same lockout hazard as deletion: if the last admin who can still sign in
    // is disabled or locked, nobody can get back into the dashboard at all.
    if (
      dto.account_status !== undefined &&
      dto.account_status !== 'active' &&
      admin.account_status === 'active' &&
      (await this.countOtherActiveAdmins(id)) === 0
    ) {
      throw new BadRequestException(
        'This is the last active admin. Create or re-activate another admin before changing this account status.',
      );
    }

    Object.assign(admin, dto);
    const saved = await this.adminRepository.save(admin);

    await this.activityService.log(actor, {
      action: 'admin.update',
      targetType: 'admin',
      targetId: saved.id,
      targetName: this.displayName(saved),
      details: `Updated admin "${saved.username}": ${fields.join(', ')}`,
    });

    return this.toPublic(saved);
  }

  /**
   * Owner-driven password reset. Also clears the failed-login counter and lifts
   * a lock, because a reset is pointless if the account stays locked out.
   */
  async resetPassword(
    id: number,
    password: string,
    actor: ActivityActor,
  ): Promise<PublicAdmin> {
    if (!password || password.length < ADMIN_MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters long`,
      );
    }

    const admin = await this.findEntity(id);
    const wasLocked = admin.account_status === 'locked';

    admin.password = await hashPassword(password);
    admin.failed_attempts = 0;
    if (wasLocked) {
      admin.account_status = 'active';
    }

    const saved = await this.adminRepository.save(admin);

    await this.activityService.log(actor, {
      action: 'admin.reset_password',
      targetType: 'admin',
      targetId: saved.id,
      targetName: this.displayName(saved),
      details: wasLocked
        ? `Reset password for "${saved.username}" and unlocked the account`
        : `Reset password for "${saved.username}"`,
    });

    return this.toPublic(saved);
  }

  /**
   * Five bad passwords lock an admin out permanently (auth.service), and there
   * is no self-service recovery — this endpoint is the only way back in.
   */
  async unlock(id: number, actor: ActivityActor): Promise<PublicAdmin> {
    const admin = await this.findEntity(id);

    admin.account_status = 'active';
    admin.failed_attempts = 0;
    const saved = await this.adminRepository.save(admin);

    await this.activityService.log(actor, {
      action: 'admin.unlock',
      targetType: 'admin',
      targetId: saved.id,
      targetName: this.displayName(saved),
      details: `Unlocked admin "${saved.username}" and reset failed login attempts`,
    });

    return this.toPublic(saved);
  }

  async remove(id: number, actor: ActivityActor): Promise<{ message: string }> {
    // Deleting yourself would end your own session mid-request, and there is no
    // signup flow to undo it with.
    if (actor?.id === id) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    const admin = await this.findEntity(id);

    // The academy must always keep at least one admin who can sign in;
    // otherwise the dashboard is unreachable and only a DB edit can fix it.
    if ((await this.countOtherActiveAdmins(id)) === 0) {
      throw new BadRequestException(
        'This is the last active admin. Create another active admin before deleting this one.',
      );
    }

    const name = this.displayName(admin);
    const username = admin.username;
    await this.adminRepository.remove(admin);

    await this.activityService.log(actor, {
      action: 'admin.delete',
      targetType: 'admin',
      targetId: id,
      targetName: name,
      details: `Deleted admin account "${username}"`,
    });

    return { message: `Admin with id ${id} has been removed.` };
  }
}
