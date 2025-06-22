import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { SaveTableDTO } from './dto/save-table.dto';
import { SaveScreenDTO } from './dto/save-screen.dto';

@Controller('developer')
export class DeveloperController {
  constructor(private readonly service: DeveloperService) {}

  @Get('tree')
  async tree() {
    return this.service.tree();
  }

  @Get('hash/:library')
  async hashLibrary(@Param('library') library: string) {
    return this.service.hashLibrary(library);
  }

  @Get('table/:library/:tableName')
  async table(
    @Param('tableName') tableName: string,
    @Param('library') library: string,
  ) {
    return this.service.table(library, tableName);
  }

  @Get('data/:library/:tableName')
  async data(
    @Param('tableName') tableName: string,
    @Param('library') library: string,
  ) {
    return this.service.data(library, tableName);
  }

  @Post('table')
  async saveTable(@Body() data: SaveTableDTO) {
    return this.service.saveTable(data);
  }

  @Post('screen')
  async saveScreen(@Body() data: SaveScreenDTO) {
    return this.service.saveScreen(data);
  }

  @Post('package')
  async createPackage(@Body() body: CreatePackageDto) {
    return this.service.createPackage(body);
  }
}
