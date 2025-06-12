import { Public } from '@hedhog/api';
import { Body, Controller, Post } from '@nestjs/common';
import { InstallDTO } from './dto/install.dto';
import { InstallService } from './install.service';

@Public()
@Controller('install')
export class InstallController {
  constructor(private readonly service: InstallService) {}

  @Post()
  install(@Body() data: InstallDTO) {
    return this.service.install(data);
  }
}
