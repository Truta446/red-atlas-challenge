import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import type { UserRole } from '../entities/user.entity';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['admin', 'user'] })
  @IsIn(['admin', 'user'])
  public role!: UserRole;
}
