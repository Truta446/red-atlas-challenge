import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public listingId?: string;

  @ApiPropertyOptional({ example: 430000 })
  @IsOptional()
  @IsNumber()
  public price?: number;

  @ApiPropertyOptional({ example: '2025-08-02' })
  @IsOptional()
  @IsDateString()
  public date?: string;
}
