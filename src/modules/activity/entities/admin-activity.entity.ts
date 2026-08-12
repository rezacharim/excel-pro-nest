import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * An audit trail of everything an administrator does in the dashboard.
 *
 * Every payment recorded, hold, suspension, program change and admin account
 * change is written here with the name of the admin who did it, so the owner
 * can always answer "who did this, and when?".
 */
@Entity('admin_activity')
export class AdminActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  adminId: number | null;

  @Column({ type: 'varchar', default: 'system' })
  adminUsername: string;

  /** Machine-readable action key, e.g. 'payment.record', 'member.suspend'. */
  @Index()
  @Column({ type: 'varchar' })
  action: string;

  /** 'member' | 'admin' | 'announcement' | 'system' */
  @Column({ type: 'varchar', default: 'member' })
  targetType: string;

  @Column({ type: 'int', nullable: true })
  targetId: number | null;

  @Column({ type: 'varchar', nullable: true })
  targetName: string | null;

  /** Human-readable one-liner shown in the Activity screen. */
  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
