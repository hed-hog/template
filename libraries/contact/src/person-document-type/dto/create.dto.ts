import { IsNumber, IsString } from 'class-validator';
import { WithLocaleDTO } from '@hed-hog/api-locale';

export class CreateDTO extends WithLocaleDTO {
  @IsNumber()
  country_id: number;

  @IsString()
  slug: string;
}
