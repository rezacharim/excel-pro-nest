import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Simple key/value store for academy-wide settings the owner can change
 * without a developer (prices, reminder timing, auto-suspend rules).
 */
@Entity('academy_settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
