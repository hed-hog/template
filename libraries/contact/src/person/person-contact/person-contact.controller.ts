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
import { PersonContactService } from './person-contact.service';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';
import { DeleteDTO } from '@hed-hog/api';

@Role()
@Controller('person/:personId/person-contact')
export class PersonContactController {
  constructor(
    @Inject(forwardRef(() => PersonContactService))
    private readonly personContactService: PersonContactService
  ) {}

  @Post()
  create(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() data: CreateDTO
  ) {
    return this.personContactService.create(personId, data);
  }

  @Get()
  list(
    @Param('personId', ParseIntPipe) personId: number,
    @Pagination() paginationParams
  ) {
    return this.personContactService.list(paginationParams, personId);
  }

  @Get(':id')
  get(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personContactService.get(personId, id);
  }

  @Patch(':id')
  update(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateDTO
  ) {
    return this.personContactService.update(personId, id, data);
  }

  @Delete()
  delete(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() { ids }: DeleteDTO
  ) {
    return this.personContactService.delete(personId, { ids });
  }
}
