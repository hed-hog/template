import { Module } from '@nestjs/common';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';
import { PrismaModule } from '@hed-hog/api-prisma';

@Module({
  imports: [PrismaModule],
  controllers: [DeveloperController],
  providers: [DeveloperService],
})
export class DeveloperModule {}
