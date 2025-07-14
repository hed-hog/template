import { IsString } from 'class-validator';
import { WithLocaleDTO } from '@hed-hog/api-locale';

export class CreateDTO extends WithLocaleDTO {
  @IsString()
  slug: string;
}
