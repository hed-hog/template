import { PrismaService } from '@hed-hog/api-prisma';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { localeStorage } from './locale-context';
import { normalizeLocaleCode } from '../util/normalize-locale';

export const DEFAULT_LOCALE = 'en';

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  private languages = [];

  constructor(private prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers['accept-language'];
    const code = normalizeLocaleCode(header);

    if (!this.languages.length) {
      const locale = await this.prisma.locale.findMany({
        select: {
          code: true,
        },
      });

      for (const l of locale) {
        this.languages.push(l.code);
      }
    }

    // "Detectado" significa que o cliente declarou um idioma que o sistema
    // realmente suporta - nao que sobrou o default. Sem essa distincao, todo
    // cliente que nao manda o header (o app mobile, por exemplo) gravaria `en`
    // como preferencia do usuario, persistindo justamente o bug que o resto
    // desta mudanca corrige.
    const detected = Boolean(code) && this.languages.includes(code);

    const resolved = detected ? code : DEFAULT_LOCALE;

    req['locale'] = resolved;
    req['localeDetected'] = detected;

    // O `run` envolve o resto da cadeia, entao quem esta longe do controller
    // (servicos de notificacao, fila) le o mesmo locale sem receber parametro.
    localeStorage.run({ locale: resolved, detected }, () => {
      next();
    });
  }
}
