import { PaginationDTO, PaginationService } from '@hed-hog/api-pagination';
import { PrismaService } from '@hed-hog/api-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { CreateDTO } from './dto/create.dto';
import { DeleteDTO } from '@hed-hog/api';
import { UpdateDTO } from './dto/update.dto';

@Injectable()
export class MailVarService {
  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => PaginationService))
    private readonly paginationService: PaginationService,
  ) {}

  async list(paginationParams: PaginationDTO) {
    const fields = ['name'];
    const OR: any[] = this.prismaService.createInsensitiveSearch(
      fields,
      paginationParams,
    );

    if (paginationParams.search && !isNaN(+paginationParams.search)) {
      OR.push({ id: { equals: +paginationParams.search } });
    }

    return this.paginationService.paginate(
      this.prismaService.mail_var,
      paginationParams,
      {
        where: {
          OR,
        },
      },
    );
  }

  async get(id: number) {
    return this.prismaService.mail_var.findUnique({
      where: { id: id },
    });
  }

  async create(data: CreateDTO) {
    return this.prismaService.mail_var.create({
      data,
    });
  }

  async update({ id, data }: { id: number; data: UpdateDTO }) {
    return this.prismaService.mail_var.update({
      where: { id: id },
      data,
    });
  }

  async delete({ ids }: DeleteDTO): Promise<{count:number}> {
    if (ids == undefined || ids == null) {
      throw new BadRequestException(
        'You must select at least one item to delete.',
      );
    }

    return this.prismaService.mail_var.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }
}
