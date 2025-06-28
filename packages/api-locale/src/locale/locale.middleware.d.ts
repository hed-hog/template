import { PrismaService } from '@hed-hog/api-prisma';
import { NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
export declare class LocaleMiddleware implements NestMiddleware {
    private prisma;
    private languages;
    constructor(prisma: PrismaService);
    use(req: Request, _res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=locale.middleware.d.ts.map