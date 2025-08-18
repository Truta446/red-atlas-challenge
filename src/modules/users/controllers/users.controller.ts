import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  @Inject(UsersService) private readonly users: UsersService;

  @Get()
  @Roles('admin', 'user')
  public async list(@CurrentUser() user: CurrentUserPayload) {
    return this.users.findAllByTenant(user.tenantId);
  }

  @Patch(':id/role')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async changeRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (id === user.sub) {
      throw new ForbiddenException('Cannot change own role');
    }
    return this.users.changeRole(id, user.tenantId, dto.role);
  }
}
