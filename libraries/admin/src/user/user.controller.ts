import { Pagination } from '@hedhog/api-pagination';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  forwardRef,
} from '@nestjs/common';
import { DeleteDTO } from '../dto/delete.dto';
import { UpdateIdsDTO } from '../dto/update-ids.dto';
import { Role } from '@hedhog/api';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';
import { UserService } from './user.service';

@Role()
@Controller('user')
export class UserController {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  @Get()
  async list(@Pagination() paginationParams) {
    return this.userService.list(paginationParams);
  }

  @Get(':userId/role')
  async listRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Pagination() paginationParams,
  ) {
    return this.userService.listRoles(userId, paginationParams);
  }

  @Patch(':userId/role')
  async updateRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() data: UpdateIdsDTO,
  ) {
    return this.userService.updateRoles(userId, data);
  }

  @Get(':userId')
  async get(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.get(userId);
  }

  @Get('email/:email')
  async getByEmail(@Param('email') email: string) {
    return this.userService.getByEmail(email);
  }

  @Post()
  create(@Body() data: CreateDTO) {
    return this.userService.create(data);
  }

  @Patch(':userId')
  async update(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() data: UpdateDTO,
  ) {
    return this.userService.update({
      id: userId,
      data,
    });
  }

  @Delete()
  async delete(@Body() data: DeleteDTO) {
    return this.userService.delete(data);
  }
}
