import { WithLocaleDTO } from '@hedhog/api-locale';
import { IsString } from 'class-validator';

export class CreateDTO extends WithLocaleDTO {
  @IsString({ message: 'Por favor, forneça um texto para o slug.' })
  slug: string;
}
