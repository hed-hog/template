import { DeleteDTO } from '@hedhog/api';
import { PaginationDTO, PaginationService } from '@hedhog/api-pagination';
import { PrismaService } from '@hedhog/api-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { CreateDTO } from './dto/create.dto';
import { UpdateDTO } from './dto/update.dto';

@Injectable()
export class DashboardUserService {
  private readonly modelName = 'dashboard_user';
  private readonly foreignKey = 'user_id';

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => PaginationService))
    private readonly paginationService: PaginationService,
  ) {}

  async list(paginationParams: PaginationDTO) {
    const fields = [];
    const OR: any[] = this.prismaService.createInsensitiveSearch(
      fields,
      paginationParams,
    );

    if (paginationParams.search && !isNaN(+paginationParams.search)) {
      OR.push({ id: { equals: +paginationParams.search } });
    }

    return this.paginationService.paginate(
      this.prismaService.dashboard_user,
      paginationParams,
      {
        where: {
          OR,
        },
        include: {
          dashboard_item: {
            include: {
              dashboard_component: true,
            },
          },
          user: true,
        },
      },
    );
  }

  async get(id: number) {
    return this.prismaService.dashboard_user.findUnique({
      where: { id: id },
    });
  }

  async create(data: CreateDTO) {
    return this.prismaService.dashboard_user.create({
      data,
    });
  }

  async update({ id, data }: { id: number; data: UpdateDTO }) {
    return this.prismaService.dashboard_user.update({
      where: { id: id },
      data,
    });
  }

  async delete({ ids }: DeleteDTO) {
    if (ids == undefined || ids == null) {
      throw new BadRequestException(
        'You must select at least one item to delete.',
      );
    }

    return this.prismaService.dashboard_user.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }
}
