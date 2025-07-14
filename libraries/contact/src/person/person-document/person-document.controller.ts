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
import { PersonDocumentService } from './person-document.service';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';
import { DeleteDTO } from '@hed-hog/api';

@Role()
@Controller('person/:personId/person-document')
export class PersonDocumentController {
  constructor(
    @Inject(forwardRef(() => PersonDocumentService))
    private readonly personDocumentService: PersonDocumentService
  ) {}

  @Post()
  create(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() data: CreateDTO
  ) {
    return this.personDocumentService.create(personId, data);
  }

  @Get()
  list(
    @Param('personId', ParseIntPipe) personId: number,
    @Pagination() paginationParams
  ) {
    return this.personDocumentService.list(paginationParams, personId);
  }

  @Get(':id')
  get(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personDocumentService.get(personId, id);
  }

  @Patch(':id')
  update(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateDTO
  ) {
    return this.personDocumentService.update(personId, id, data);
  }

  @Delete()
  delete(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() { ids }: DeleteDTO
  ) {
    return this.personDocumentService.delete(personId, { ids });
  }
}
