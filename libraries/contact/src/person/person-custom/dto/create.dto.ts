import { IsNumber, IsString, IsOptional } from 'class-validator';
import { WithLocaleDTO } from '@hed-hog/api-locale';

export class CreateDTO extends WithLocaleDTO {
  @IsNumber()
  type_id: number;

  @IsOptional()
  @IsString()
  value?: string;
}
