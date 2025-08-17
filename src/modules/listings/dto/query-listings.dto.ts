import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, IsNumber } from 'class-validator';

export class QueryListingsDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'sold'] })
  @IsOptional()
  @IsEnum(['active', 'paused', 'sold'])
  public status?: 'active' | 'paused' | 'sold';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public propertyId?: string;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  public minPrice?: number;

  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  public maxPrice?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;

  @ApiPropertyOptional({ description: 'Cursor base64url' })
  @IsOptional()
  @IsString()
  public cursor?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  public order?: 'asc' | 'desc';
}
