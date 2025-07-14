import { PaginationService, PaginationDTO } from '@hed-hog/api-pagination';
import { PrismaService } from '@hed-hog/api-prisma';
import {
  Injectable,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';
import { DeleteDTO } from '@hed-hog/api';

@Injectable()
export class PersonValueService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService
  ) {}

  async create(personId: number, data: CreateDTO) {
    return this.prismaService.person_value.create({
      data: {
        person_id: personId,
        ...data
      }
    });
  }

  async get(personId: number, id: number) {
    return this.prismaService.person_value.findFirst({
      where: {
        person_id: personId,
        id: id
      }
    });
  }

  async list(paginationParams: PaginationDTO, personId?: number) {
    const where: any = {};
    if (personId !== undefined) where.person_id = personId;

    return this.paginationService.paginate(
      this.prismaService.person_value,
      {
        fields: 'value',
        ...paginationParams
      },
      {
        where
      }
    );
  }

  async update(personId: number, id: number, data: UpdateDTO) {
    return this.prismaService.person_value.updateMany({
      where: {
        person_id: personId,
        id: id
      },
      data
    });
  }

  async delete(personId: number, { ids }: DeleteDTO) {
    if (ids == undefined || ids == null) {
      throw new BadRequestException(
        'You must select at least one item to delete.'
      );
    }

    return this.prismaService.person_value.deleteMany({
      where: {
        person_id: personId,
        id: {
          in: ids
        }
      }
    });
  }
}
