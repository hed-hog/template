import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { CreatePackageDto } from './dto/create-package.dto';

@Controller('developer')
export class DeveloperController {
  constructor(private readonly service: DeveloperService) {}

  @Get('tree')
  async test() {
    return this.service.tree();
  }

  @Post('package')
  async createPackage(@Body() body: CreatePackageDto) {
    return this.service.createPackage(body);
  }
}
