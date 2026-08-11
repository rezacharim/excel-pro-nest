import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { SubscriptionPlan } from '../../users/entities/enums/enums';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'usd' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  plan: SubscriptionPlan;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @ManyToOne(() => User, (user) => user.payments, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  // Payment method: 'stripe' | 'etransfer' | 'cash' | 'other'
  @Column({ type: 'varchar', default: 'stripe' })
  method: string;

  // Payment type: 'membership' | 'league'
  @Column({ type: 'varchar', default: 'membership' })
  type: string;

  // Optional human-readable period, e.g. 'Sep-Oct 2026' or 'Fall League 2026'
  @Column({ type: 'varchar', nullable: true })
  periodLabel: string | null;

  @Column({ nullable: true, type: 'text' })
  note: string | null;

  @Column({ default: false })
  isFirstTimePayment: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  subscriptionEndDate: Date;

  @Column({ default: false })
  reminderSent: boolean;

  @Column({ default: 0 })
  expiredReminderCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
