import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TransactionsService } from './transactions.service';
import type { QueryTransactionsDto } from './dto/query-transactions.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import type { Transaction } from './transaction.entity';

@ApiTags('Transactions')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  @Inject(TransactionsService) private readonly service!: TransactionsService;

  @Get()
  @HttpCode(HttpStatus.OK)
  public async list(
    @Query() query: QueryTransactionsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ items: Transaction[]; nextCursor: string | null }> {
    return this.service.findMany(query, user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'user')
  public async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Transaction> {
    return this.service.create(dto, user.tenantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getById(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<Transaction | null> {
    return this.service.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Transaction> {
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
  public async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<Transaction> {
    return this.service.restore(id, user.tenantId);
  }
}
