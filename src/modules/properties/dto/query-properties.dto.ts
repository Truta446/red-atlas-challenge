import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const SORT_WHITELIST = ['price', 'createdAt', 'distance'] as const;
export type SortBy = (typeof SORT_WHITELIST)[number];
export type Order = 'asc' | 'desc';

export class QueryPropertiesDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Sector/neighborhood', example: 'Moema' })
  public sector?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Property type', example: 'apartment' })
  public type?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Address search (ILIKE)', example: 'Alameda' })
  public address?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Minimum price', example: 200000 })
  public minPrice?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Maximum price', example: 1500000 })
  public maxPrice?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filter by createdAt from this ISO date (inclusive)',
  })
  public fromDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filter by createdAt up to this ISO date (inclusive)',
  })
  public toDate?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Latitude for radial filter', example: -23.56 })
  public latitude?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Longitude for radial filter', example: -46.64 })
  public longitude?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Radius in KM', example: 5 })
  public radiusKm?: number; // radius in KM

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Base64 cursor of last id' })
  public cursor?: string; // base64 id cursor

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ description: 'Items limit', example: 50 })
  public limit?: number;

  @IsOptional()
  @IsIn(SORT_WHITELIST as unknown as string[])
  @ApiPropertyOptional({ description: 'Sort field', enum: SORT_WHITELIST })
  public sortBy?: SortBy;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  public order?: Order;
}
