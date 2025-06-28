import { PrismaAstNode } from '@loancrate/prisma-schema-parser';
export declare class SchemaService {
    parse(path: string): Promise<PrismaAstNode>;
    stringify(path: string, data: PrismaAstNode): Promise<void>;
}
//# sourceMappingURL=schema.service.d.ts.map