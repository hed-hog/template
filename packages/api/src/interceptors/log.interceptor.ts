// log.interceptor.ts
import { PrismaService } from '@hed-hog/api-prisma';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { LOG_OPERATION_METADATA } from '../decorators/log.decorator';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const logMeta = this.reflector.get(LOG_OPERATION_METADATA, handler);

    if (!logMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const userId = request.auth?.sub

    return next.handle().pipe(
      tap(async () => {
        if (userId) {
          // create a registry on the table
        }}),
    );
  }
}
