import { CreateDTO } from './dto/create.dto';
import { DeleteDTO } from './dto/delete.dto';
import { SetEnabledDTO } from './dto/set-enabled.dto';
import { UpdateDTO } from './dto/update.dto';
import { LocaleService } from './locale.service';
export declare class LocaleController {
    private readonly localeService;
    constructor(localeService: LocaleService);
    listEnabled(paginationParams: any, locale: string): Promise<{
        total: any;
        lastPage: number;
        page: number;
        pageSize: number;
        prev: number;
        next: number;
        data: any;
    }>;
    getTranslations(localeCode: string, namespace: string): Promise<{}>;
    list(locale: any, paginationParams: any): Promise<{
        total: any;
        lastPage: number;
        page: number;
        pageSize: number;
        prev: number;
        next: number;
        data: any;
    }>;
    get(id: number): Promise<{
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
    update(id: number, data: UpdateDTO): Promise<{
        id: number;
        created_at: Date;
        code: string;
        region: string;
        enabled: boolean;
        updated_at: Date;
    }>;
    setEnabled({ codes }: SetEnabledDTO): Promise<void>;
    delete(data: DeleteDTO): Promise<void>;
}
//# sourceMappingURL=locale.controller.d.ts.map