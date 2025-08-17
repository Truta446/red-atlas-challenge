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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateListingDto } from '../dto/create-listing.dto';
import type { QueryListingsDto } from '../dto/query-listings.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import type { Listing } from '../entities/listing.entity';
import { ListingsService } from '../services/listings.service';

@ApiTags('Listings')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'listings', version: '1' })
export class ListingsController {
  @Inject(ListingsService) private readonly service!: ListingsService;

  @Get()
  @HttpCode(HttpStatus.OK)
  public async list(
    @Query() query: QueryListingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ items: Listing[]; nextCursor: string | null }> {
    return this.service.findMany(query, user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'user')
  public async create(@Body() dto: CreateListingDto, @CurrentUser() user: CurrentUserPayload): Promise<Listing> {
    return this.service.create(dto, user.tenantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getById(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<Listing | null> {
    return this.service.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Listing> {
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
  public async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<Listing> {
    return this.service.restore(id, user.tenantId);
  }
}
