import { Public } from '@hed-hog/api';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  /**
   * Alvo da readinessProbe (só dela — ver AppService.getReadiness).
   *
   * O 503 é montado na resposta em vez de lançado como ServiceUnavailableException
   * de propósito: qualquer 5xx lançado passa pelo HttpExceptionFilter e vira evento
   * no Sentry, o que com uma probe a cada 10s por pod significaria reportar a queda
   * do banco indefinidamente, em duplicidade com o que o próprio filtro já reporta.
   */
  @Get('health/ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.appService.getReadiness();

    if (readiness.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
