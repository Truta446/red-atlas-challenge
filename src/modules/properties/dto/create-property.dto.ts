import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @MaxLength(255)
  public address!: string;

  @IsString()
  @MaxLength(64)
  public sector!: string;

  @IsString()
  @MaxLength(64)
  public type!: string;

  @IsString()
  public price!: string; // decimal as string

  @IsNumber()
  public latitude!: number;

  @IsNumber()
  public longitude!: number;

  @IsOptional()
  @IsString()
  public tenantId?: string;
}
