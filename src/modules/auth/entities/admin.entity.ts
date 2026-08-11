import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin')
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: false })
  username: string;

  @Column({ type: 'text', nullable: false })
  email: string;

  @Column({ type: 'text', nullable: false })
  first_name: string;

  @Column({ type: 'text', nullable: false })
  last_name: string;

  @Column({ type: 'text', nullable: false })
  password: string;

  @Column({
    enum: ['active', 'locked', 'disabled'],
    nullable: false,
    default: 'active',
  })
  account_status: string;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  last_login: Date;

  @Column({ type: 'int', nullable: false, default: 0 })
  failed_attempts: number;

  //   @OneToMany(() => Matche, (matche) => matche.admin)
  //   matches: Matche[];
}
