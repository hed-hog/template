import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { CreatePackageDto } from './dto/create-package.dto';

@Controller('developer')
export class DeveloperController {
  constructor(private readonly service: DeveloperService) {}

  @Get('tree')
  async tree() {
    return this.service.tree();
  }

  @Get('table/:library/:tableName')
  async table(
    @Param('tableName') tableName: string,
    @Param('library') library: string,
  ) {
    return this.service.table(library, tableName);
  }

  @Post('package')
  async createPackage(@Body() body: CreatePackageDto) {
    return this.service.createPackage(body);
  }
}
