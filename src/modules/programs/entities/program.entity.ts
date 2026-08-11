import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
@Entity('program')
export class Program {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  index_image_url: string;

  @Column({ type: 'text' })
  program_name: string;

  @Column('float')
  price: number;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
