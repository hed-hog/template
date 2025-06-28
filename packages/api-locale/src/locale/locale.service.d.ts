import { PaginationDTO, PaginationService } from '@hed-hog/api-pagination';
import { PrismaService } from '@hed-hog/api-prisma';
import { CreateDTO } from './dto/create.dto';
import { DeleteDTO } from './dto/delete.dto';
import { UpdateDTO } from './dto/update.dto';
export declare class LocaleService {
    private readonly prismaService;
    private readonly paginationService;
    private codes;
    constructor(prismaService: PrismaService, paginationService: PaginationService);
    setEnabled(codes: string[]): Promise<void>;
    parseLocale(locale: string): {
        code: string;
        region: string;
        locale: string[];
    };
    enabledLocalesMap(): Promise<any>;
    getEnables(currentLocale: string, paginationParams?: PaginationDTO): Promise<{
        total: any;
        lastPage: number;
        page: number;
        pageSize: number;
        prev: number;
        next: number;
        data: any;
    }>;
    getTranslations(localeCode: string, namespace: string): Promise<{}>;
    list(currentLocale: string, paginationParams: PaginationDTO): Promise<{
        total: any;
        lastPage: number;
        page: number;
        pageSize: number;
        prev: number;
        next: number;
        data: any;
    }>;
    getByCode(code: string): Promise<any>;
    get(localeId: number): Promise<{
        id: number;
        created_at: Date;
        code: string;
        region: string;
        enabled: boolean;
        updated_at: Date;
    }>;
    create(data: CreateDTO): Promise<{
        id: number;
        created_at: Date;
        code: string;
        region: string;
        enabled: boolean;
        updated_at: Date;
    }>;
    update({ id, data }: {
        id: number;
        data: UpdateDTO;
    }): Promise<{
        id: number;
        created_at: Date;
        code: string;
        region: string;
        enabled: boolean;
        updated_at: Date;
    }>;
    delete({ ids }: DeleteDTO): Promise<void>;
    private getTableNameTranslations;
    createModelWithLocale<T>(modelName: string, foreignKeyName: string, data: T): Promise<any>;
    updateModelWithLocale<T>(modelName: string, foreignKeyName: string, id: number, data: T, where?: any): Promise<any>;
    getModelWithLocaleWhere(modelName: string, where: any): Promise<any>;
    getModelWithCurrentLocaleWhere(modelName: string, where: any, locale: string): Promise<any>;
    getModelWithLocale(modelName: string, id: number): Promise<any>;
    private mapLocaleData;
    private handleError;
    listModelWithLocale(locale: string, modelName: string, paginationParams: PaginationDTO, where?: any, include?: any): Promise<{
        total: any;
        lastPage: number;
        page: number;
        pageSize: number;
        prev: number;
        next: number;
        data: any;
    }>;
}
//# sourceMappingURL=locale.service.d.ts.map