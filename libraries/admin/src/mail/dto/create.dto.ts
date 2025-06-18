import { IsString } from 'class-validator';
import { WithLocaleDTO } from '@hedhog/api-locale';

export class CreateDTO extends WithLocaleDTO {
  @IsString()
  slug: string;
}
