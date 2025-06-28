import { WithLocaleDTO } from '@hed-hog/api-locale';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDTO extends WithLocaleDTO {
  @IsString()
  @IsNotEmpty()
  slug: string;
}
