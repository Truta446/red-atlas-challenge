import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export class UpdateListingDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'sold'] })
  @IsOptional()
  @IsEnum(['active', 'paused', 'sold'])
  public status?: 'active' | 'paused' | 'sold';

  @ApiPropertyOptional({ example: 360000 })
  @IsOptional()
  @IsNumber()
  public price?: number;
}
