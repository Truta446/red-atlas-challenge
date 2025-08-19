import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ImportJob } from '../entities/import-job.entity';
import { ImportsService } from '../services/imports.service';

@ApiTags('Imports')
@ApiBearerAuth()
@Controller({ path: 'imports', version: '1' })
@UseGuards(AuthGuard)
export class ImportsController {
  @Inject(ImportsService) private readonly service: ImportsService;

  @Post()
  @HttpCode(202)
  @ApiBody({ description: 'CSV file in request body (text/csv)', required: true })
  @ApiResponse({ status: 202, description: 'Accepted. Returns import job id.' })
  public async create(
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: { tenantId: string },
  ): Promise<{ id: string; status: string }> {
    if (!idempotencyKey) {
      throw new HttpException('Missing Idempotency-Key header', HttpStatus.BAD_REQUEST);
    }
    if ((req.headers['content-type'] || '').indexOf('text/csv') === -1) {
      throw new HttpException('Content-Type must be text/csv', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    const job = await this.service.enqueueImport(user.tenantId, idempotencyKey, req.body);
    return { id: job.id, status: job.status };
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Import job status' })
  public async getOne(@Param('id') id: string, @CurrentUser() user: { tenantId: string }): Promise<ImportJob> {
    return this.service.getJob(user.tenantId, id);
  }
}
