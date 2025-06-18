import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsHexColor,
  IsOptional,
  IsString,
  IsStrongPassword,
  ValidateIf,
} from 'class-validator';

export class InstallDTO {
  @IsString()
  appName: string;

  @IsHexColor()
  primaryColor: string;

  @IsEmail()
  rootEmail: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 0,
    minUppercase: 0,
    minNumbers: 0,
    minSymbols: 0,
  })
  rootPassword: string;

  @IsOptional()
  @IsString({ each: true })
  language: string[];

  @IsOptional()
  @ValidateIf((_, file) => file)
  @Transform(({ value }) => {
    if (!value.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('Apenas arquivos PNG são permitidos');
    }
    return value;
  })
  logoFull: string;

  @IsOptional()
  @ValidateIf((_, file) => file)
  @Transform(({ value }) => {
    if (!value.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('Apenas arquivos PNG são permitidos');
    }
    return value;
  })
  logoIcon: string;
}
