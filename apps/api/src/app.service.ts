import { PrismaService } from '@hed-hog/api-prisma';
import { Injectable } from '@nestjs/common';
import { timestampColumn } from '@hed-hog/api';
import { PaginationService } from '@hed-hog/api-pagination';

@Injectable()
export class AppService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  async getHello() {
    return {
      column: timestampColumn(),
      result: await this.prismaService.component_prop_type.findMany(),
      pagination: await this.pagination.paginate(
        this.prismaService.component_prop_type,
        {
          fields: 'id,slug',
        },
        {},
      ),
    };
  }
}
