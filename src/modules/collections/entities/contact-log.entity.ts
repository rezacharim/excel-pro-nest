import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A note of every time the academy contacted a family about a payment —
 * "called Aug 12, will pay Friday". Keeps the chasing organised when more
 * than one person is following up.
 */
@Entity('contact_log')
export class ContactLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  userId: number;

  /** 'call' | 'email' | 'text' | 'in_person' | 'reminder_email' */
  @Column({ type: 'varchar', default: 'call' })
  method: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Optional follow-up date the admin promised to check back on. */
  @Column({ type: 'timestamp', nullable: true })
  followUpAt: Date | null;

  @Column({ type: 'varchar', default: 'system' })
  adminUsername: string;

  @CreateDateColumn()
  createdAt: Date;
}
