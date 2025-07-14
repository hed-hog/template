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
import { PersonAddressService } from './person-address.service';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';
import { DeleteDTO } from '@hed-hog/api';

@Role()
@Controller('person/:personId/person-address')
export class PersonAddressController {
  constructor(
    @Inject(forwardRef(() => PersonAddressService))
    private readonly personAddressService: PersonAddressService
  ) {}

  @Post()
  create(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() data: CreateDTO
  ) {
    return this.personAddressService.create(personId, data);
  }

  @Get()
  list(
    @Param('personId', ParseIntPipe) personId: number,
    @Pagination() paginationParams
  ) {
    return this.personAddressService.list(paginationParams, personId);
  }

  @Get(':id')
  get(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personAddressService.get(personId, id);
  }

  @Patch(':id')
  update(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateDTO
  ) {
    return this.personAddressService.update(personId, id, data);
  }

  @Delete()
  delete(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() { ids }: DeleteDTO
  ) {
    return this.personAddressService.delete(personId, { ids });
  }
}
