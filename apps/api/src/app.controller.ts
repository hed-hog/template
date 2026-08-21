import { Public } from '@hed-hog/api';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

}
