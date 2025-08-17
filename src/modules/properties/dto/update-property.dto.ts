import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Address' })
  public address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Sector/neighborhood' })
  public sector?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Property type' })
  public type?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Price' })
  public price?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Latitude for location update' })
  public latitude?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: 'Longitude for location update' })
  public longitude?: number;
}
