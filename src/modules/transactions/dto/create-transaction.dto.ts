import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public propertyId!: string;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  public listingId?: string;

  @ApiProperty({ example: 420000 })
  @IsNumber()
  public price!: number;

  @ApiProperty({ example: '2025-08-01', description: 'YYYY-MM-DD' })
  @IsDateString()
  public date!: string;
}
