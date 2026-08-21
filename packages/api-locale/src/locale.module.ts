import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { forwardRef, MiddlewareConsumer, Module } from '@nestjs/common';
import { LocaleController } from './locale/locale.controller';
import { LocaleMiddleware } from './locale/locale.middleware';
import { LocaleService } from './locale/locale.service';

@Module({
  imports: [
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
    forwardRef(() => LocaleModule),
  ],
  controllers: [LocaleController],
  providers: [LocaleService],
  exports: [LocaleService],
})
export class LocaleModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LocaleMiddleware).forRoutes('*');
  }
}
