import { IsString } from 'class-validator';

export class CreatePackageDto {
  @IsString()
  name: string;
}
