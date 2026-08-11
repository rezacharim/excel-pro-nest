import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TransferStatus } from './enums/transfer-status.enum';
import { SubscriptionPlan } from '../../users/entities/enums/enums';

@Entity('transfers')
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string | number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'usd' })
  currency: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  plan: SubscriptionPlan;

  @Column({ type: 'uuid', unique: true })
  token: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ default: false })
  isFirstTimePayment: boolean;

  @Column({ type: 'boolean', default: false })
  confirmedByUser: boolean; // User confirmed they made the payment

  @Column({ type: 'boolean', default: false })
  verifiedByAdmin: boolean; // Admin verified the payment

  @Column({ nullable: true })
  adminId: number; // Admin who verified the payment

  @Column({ nullable: true })
  adminNotes: string; // Any notes from the admin

  @Column({ nullable: true, type: 'timestamp' })
  confirmedAt: Date; // When user confirmed payment

  @Column({ nullable: true, type: 'timestamp' })
  verifiedAt: Date; // When admin verified payment

  @Column({ nullable: true, type: 'timestamp' })
  subscriptionEndDate: Date; // When subscription ends

  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date | null; // Payment request expiry date

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
