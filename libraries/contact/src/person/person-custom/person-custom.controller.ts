import { Pagination } from '@hed-hog/api-pagination';
import { Role } from '@hed-hog/api';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Inject,
  forwardRef
} from '@nestjs/common';
import { PersonCustomService } from './person-custom.service';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';
import { DeleteDTO } from '@hed-hog/api';
import { Locale } from '@hed-hog/api-locale';

@Role()
@Controller('person/:personId/person-custom')
export class PersonCustomController {
  constructor(
    @Inject(forwardRef(() => PersonCustomService))
    private readonly personCustomService: PersonCustomService
  ) {}

  @Post()
  create(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() data: CreateDTO
  ) {
    return this.personCustomService.create(personId, data);
  }

  @Get()
  list(
    @Locale() locale,
    @Param('personId', ParseIntPipe) personId: number,
    @Pagination() paginationParams
  ) {
    return this.personCustomService.list(locale, personId, paginationParams);
  }

  @Patch(':id')
  update(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateDTO
  ) {
    return this.personCustomService.update(personId, id, data);
  }

  @Delete()
  delete(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() { ids }: DeleteDTO
  ) {
    return this.personCustomService.delete(personId, { ids });
  }
}
