import { WithLocaleDTO } from '@hedhog/api-locale';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDTO extends WithLocaleDTO {
  @IsString()
  @IsNotEmpty()
  slug: string;
}
