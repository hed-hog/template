import {
  IsEmail,
  IsHexColor,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class InstallDTO {
  @IsString()
  appName: string;
  @IsHexColor()
  primaryColor: string;
  @IsEmail()
  rootEmail: string;
  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  rootPassword: string;
  @IsString({ each: true })
  language: string[];
}
