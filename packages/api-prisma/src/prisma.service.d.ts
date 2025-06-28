import { OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
export declare class PrismaService extends PrismaClient implements OnModuleInit {
    [key: string]: any;
    onModuleInit(): Promise<void>;
    getProvider(): any;
    isPostgres(): boolean;
    isMysql(): boolean;
    createInsensitiveSearch(fields: string[], paginationParams: {
        search: string;
    }): any[];
    getFields(modelName: string): string[];
    getValidData(modelName: string, data: any): any;
}
//# sourceMappingURL=prisma.service.d.ts.map