import { PrismaService } from '@hedhog/api-prisma';
import { Injectable } from '@nestjs/common';
import { timestampColumn } from '@hedhog/api';
import { PaginationService } from '@hedhog/api-pagination';

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
