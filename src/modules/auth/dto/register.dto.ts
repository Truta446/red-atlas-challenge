import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  public email!: string;

  @IsString()
  @MinLength(8)
  public password!: string;

  @IsOptional()
  @IsString()
  public tenantId?: string;
}
