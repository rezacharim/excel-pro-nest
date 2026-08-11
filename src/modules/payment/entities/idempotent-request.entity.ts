import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  operation: string;

  @Column({ type: 'json', nullable: true })
  responseData: any;

  @Column({ type: 'boolean', default: false })
  isProcessed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
