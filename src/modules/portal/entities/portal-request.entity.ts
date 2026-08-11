import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * A request submitted by a parent from the parent portal.
 * kind: 'hold' | 'installment'
 * status: 'pending' | 'approved' | 'rejected' (admin-managed)
 */
@Entity('portal_requests')
export class PortalRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  // 'hold' | 'installment'
  @Column({ type: 'varchar' })
  kind: string;

  @Column({ nullable: true, type: 'timestamp' })
  resumeAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  note: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ type: 'int', nullable: true })
  installments: number | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
