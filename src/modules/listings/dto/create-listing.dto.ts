import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsUUID } from 'class-validator';

export class CreateListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public propertyId!: string;

  @ApiProperty({ enum: ['active', 'paused', 'sold'] })
  @IsEnum(['active', 'paused', 'sold'])
  public status!: 'active' | 'paused' | 'sold';

  @ApiProperty({ example: 350000 })
  @IsNumber()
  public price!: number;
}
