import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SchemaService } from './schema.service';

@Module({
  providers: [PrismaService, SchemaService],
  exports: [PrismaService, SchemaService],
})
export class PrismaModule {}
