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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateListingDto } from '../dto/create-listing.dto';
import { QueryListingsDto } from '../dto/query-listings.dto';
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
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String, description: 'UUID' })
  @ApiQuery({ name: 'sector', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'address', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'fromDate', required: false, type: String, description: 'YYYY-MM-DD (createdAt from)' })
  @ApiQuery({ name: 'toDate', required: false, type: String, description: 'YYYY-MM-DD (createdAt to)' })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'radiusKm', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'price', 'distance'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
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
