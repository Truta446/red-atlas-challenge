import { Column, Entity, Index } from 'typeorm';

import { BaseEntityWithTenant } from '../../../common/entities/base.entity';

export type UserRole = 'user' | 'admin';

@Entity('users')
export class User extends BaseEntityWithTenant {
  @Index({ unique: true })
  @Column({ type: 'citext' })
  public email!: string;

  @Column({ type: 'text', name: 'password_hash' })
  public passwordHash!: string;

  @Column({ type: 'varchar', length: 10, default: 'user' })
  public role!: UserRole;

  @Column({ type: 'text', name: 'refresh_token_hash', nullable: true })
  public refreshTokenHash?: string | null;
}
