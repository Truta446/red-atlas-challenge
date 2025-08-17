import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  public email!: string;

  @IsString()
  @MinLength(8)
  public password!: string;
}
