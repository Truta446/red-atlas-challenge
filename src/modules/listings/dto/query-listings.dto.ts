import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, IsNumber, IsDateString } from 'class-validator';

const SORT_WHITELIST = ['createdAt', 'price', 'distance'] as const;
export type SortBy = (typeof SORT_WHITELIST)[number];

export class QueryListingsDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'sold'] })
  @IsOptional()
  @IsEnum(['active', 'paused', 'sold'])
  public status?: 'active' | 'paused' | 'sold';

  @ApiPropertyOptional({ description: 'Sector/neighborhood', example: 'Moema' })
  @IsOptional()
  @IsString()
  public sector?: string;

  @ApiPropertyOptional({ description: 'Property type', example: 'apartment' })
  @IsOptional()
  @IsString()
  public type?: string;

  @ApiPropertyOptional({ description: 'Address search (ILIKE)', example: 'Alameda' })
  @IsOptional()
  @IsString()
  public address?: string;

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

  @ApiPropertyOptional({ example: '2025-08-01' })
  @IsOptional()
  @IsDateString()
  public fromDate?: string;

  @ApiPropertyOptional({ example: '2025-08-31' })
  @IsOptional()
  @IsDateString()
  public toDate?: string;

  @ApiPropertyOptional({ description: 'Latitude for radial filter', example: -23.56 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  public latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude for radial filter', example: -46.64 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  public longitude?: number;

  @ApiPropertyOptional({ description: 'Radius in KM', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  public radiusKm?: number;

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

  @ApiPropertyOptional({ enum: SORT_WHITELIST })
  @IsOptional()
  @IsIn(SORT_WHITELIST as unknown as string[])
  public sortBy?: SortBy;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  public order?: 'asc' | 'desc';
}
