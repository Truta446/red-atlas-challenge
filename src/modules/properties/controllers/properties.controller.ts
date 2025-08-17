import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { QueryPropertiesDto } from '../dto/query-properties.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { Property } from '../entities/property.entity';
import { PropertiesService } from '../services/properties.service';

@Controller({ path: 'properties', version: '1' })
@ApiTags('Properties')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, RolesGuard)
export class PropertiesController {
  @Inject(PropertiesService) private readonly service: PropertiesService;

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  @HttpCode(HttpStatus.OK)
  public async list(
    @Query() query: QueryPropertiesDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ items: Property[]; nextCursor: string | null }> {
    return this.service.findMany(query, user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'user')
  public async create(@Body() dto: CreatePropertyDto, @CurrentUser() user: CurrentUserPayload): Promise<Property> {
    return this.service.create(dto, user.tenantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getById(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<Property | null> {
    return this.service.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Property> {
    return this.service.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  public async softDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<void> {
    await this.service.softDelete(id, user.tenantId);
  }

  @Patch(':id/restore')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<Property> {
    return this.service.restore(id, user.tenantId);
  }
}
