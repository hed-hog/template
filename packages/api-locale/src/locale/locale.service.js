"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaleService = void 0;
const api_1 = require("@hed-hog/api");
const api_pagination_1 = require("@hed-hog/api-pagination");
const api_prisma_1 = require("@hed-hog/api-prisma");
const common_1 = require("@nestjs/common");
let LocaleService = class LocaleService {
    prismaService;
    paginationService;
    codes = {};
    constructor(prismaService, paginationService) {
        this.prismaService = prismaService;
        this.paginationService = paginationService;
    }
    async setEnabled(codes) {
        if (!codes || codes.length < 1) {
            throw new common_1.BadRequestException('You must select at least one item code.');
        }
        await this.prismaService.locale.updateMany({
            where: {
                enabled: true,
            },
            data: {
                enabled: false,
            },
        });
        await this.prismaService.locale.updateMany({
            where: {
                code: {
                    in: codes,
                },
            },
            data: {
                enabled: true,
            },
        });
    }
    parseLocale(locale) {
        const localeCodes = locale.toLowerCase().split('-');
        const code = localeCodes[0];
        const region = localeCodes[1];
        return {
            code,
            region,
            locale: localeCodes,
        };
    }
    async enabledLocalesMap() {
        const enabledLocales = await this.getEnables('en', {
            search: '',
            pageSize: 10,
            page: 1,
            sortField: 'code',
            sortOrder: api_pagination_1.PageOrderDirection.Asc,
            fields: 'code,id',
        });
        return enabledLocales.data.reduce((acc, locale) => {
            acc[locale.code] = locale.id;
            return acc;
        }, {});
    }
    async getEnables(currentLocale, paginationParams) {
        paginationParams = Object.assign({
            search: '',
            pageSize: 100,
            page: 1,
            fields: '',
            sortField: 'code',
            sortOrder: api_pagination_1.PageOrderDirection.Asc,
        }, paginationParams);
        const fields = ['code', 'region'];
        const OR = this.prismaService.createInsensitiveSearch(fields, paginationParams);
        const result = await this.paginationService.paginate(this.prismaService.locale, paginationParams, {
            where: {
                AND: [
                    {
                        enabled: true,
                    },
                    {
                        OR,
                    },
                ],
            },
        });
        const codes = [];
        for (const item of result.data) {
            codes.push(item.code);
        }
        const { code, region, locale } = this.parseLocale(currentLocale);
        const where = {
            locale: {
                code,
            },
            translation_namespace: {
                name: 'translation',
            },
        };
        if (locale.length > 1) {
            where.locale.region = region;
        }
        const values = await this.prismaService.translation.findMany({
            where,
            select: {
                name: true,
                value: true,
            },
        });
        for (let i = 0; i < result.data.length; i++) {
            for (const value of values) {
                if (value.name === result.data[i].code) {
                    result.data[i].name = value.value;
                    break;
                }
            }
        }
        return result;
    }
    async getTranslations(localeCode, namespace) {
        if (!localeCode) {
            throw new common_1.BadRequestException('Locale code is required.');
        }
        if (!namespace) {
            namespace = 'translation';
        }
        const { code, region, locale } = this.parseLocale(localeCode);
        const where = {
            locale: {
                code,
            },
            translation_namespace: {
                name: namespace,
            },
        };
        if (locale.length > 1) {
            where.locale.region = region;
        }
        const values = await this.prismaService.translation.findMany({
            where,
            select: {
                name: true,
                value: true,
            },
        });
        const translation = {};
        for (const value of values) {
            translation[value.name] = value.value;
        }
        return translation;
    }
    async list(currentLocale, paginationParams) {
        const fields = ['code', 'region'];
        const OR = this.prismaService.createInsensitiveSearch(fields, paginationParams);
        const result = await this.paginationService.paginate(this.prismaService.locale, paginationParams, {
            where: {
                OR,
            },
        });
        const codes = [];
        for (const item of result.data) {
            codes.push(item.code);
        }
        const { code, region, locale } = this.parseLocale(currentLocale);
        const where = {
            locale: {
                code,
            },
            translation_namespace: {
                name: 'translation',
            },
        };
        if (locale.length > 1) {
            where.locale.region = region;
        }
        const values = await this.prismaService.translation.findMany({
            where,
            select: {
                name: true,
                value: true,
            },
        });
        for (let i = 0; i < result.data.length; i++) {
            for (const value of values) {
                if (value.name === result.data[i].code) {
                    result.data[i].name = value.value;
                    break;
                }
            }
        }
        return result;
    }
    async getByCode(code) {
        if (this.codes[code]) {
            return this.codes[code];
        }
        return (this.codes[code] = await this.prismaService.locale.findFirst({
            where: { code },
        }));
    }
    async get(localeId) {
        return this.prismaService.locale.findUnique({
            where: { id: localeId },
        });
    }
    async create(data) {
        return this.prismaService.locale.create({
            data,
        });
    }
    async update({ id, data }) {
        return this.prismaService.locale.update({
            where: { id },
            data,
        });
    }
    async delete({ ids }) {
        if (ids == undefined || ids == null) {
            throw new common_1.BadRequestException('You must select at least one item to delete.');
        }
        await this.prismaService.locale.deleteMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });
    }
    getTableNameTranslations(modelName) {
        return `${modelName}_locale`;
    }
    async createModelWithLocale(modelName, foreignKeyName, data) {
        try {
            const model = await this.prismaService[modelName].create({
                data: this.prismaService.getValidData(modelName, data),
            });
            const { locale } = data;
            if (locale) {
                await Promise.all(Object.entries(locale).map(async ([localeCode, localeData]) => {
                    const localeRecord = await this.getByCode(localeCode);
                    const localeEntry = {
                        [foreignKeyName]: model.id,
                        locale_id: localeRecord.id,
                        ...localeData,
                    };
                    await this.prismaService[this.getTableNameTranslations(modelName)].create({
                        data: localeEntry,
                    });
                }));
            }
            return this.prismaService[modelName].findUnique({
                where: { id: model.id },
                include: {
                    [this.getTableNameTranslations(modelName)]: {
                        where: { locale: { enabled: true } },
                        include: { locale: { select: { code: true } } },
                    },
                },
            });
        }
        catch (error) {
            if (error.message.includes('Unique constraint failed')) {
                throw new common_1.BadRequestException('Data already exists.');
            }
            else {
                throw new common_1.BadRequestException(error);
            }
        }
    }
    async updateModelWithLocale(modelName, foreignKeyName, id, data, where = {}) {
        try {
            const { locale } = data;
            if (locale) {
                await Promise.all(Object.entries(locale).map(async ([localeCode, localeData]) => {
                    const localeRecord = await this.getByCode(localeCode);
                    const localeEntry = {
                        [foreignKeyName]: id,
                        locale_id: localeRecord.id,
                        ...localeData,
                    };
                    await this.prismaService[this.getTableNameTranslations(modelName)].upsert({
                        where: {
                            [`${foreignKeyName}_locale_id`]: {
                                [foreignKeyName]: id,
                                locale_id: localeRecord.id,
                            },
                        },
                        create: localeEntry,
                        update: localeData,
                    });
                }));
            }
            return this.prismaService[modelName].update({
                where: { ...where, id },
                data: this.prismaService.getValidData(modelName, data),
            });
        }
        catch (error) {
            console.error(error);
            if (error.message.includes('Unique constraint failed')) {
                throw new common_1.BadRequestException('Data already exists.');
            }
            else {
                throw new common_1.BadRequestException(error);
            }
        }
    }
    async getModelWithLocaleWhere(modelName, where) {
        try {
            const model = await this.prismaService[modelName].findUnique({
                where,
                include: {
                    [this.getTableNameTranslations(modelName)]: {
                        where: { locale: { enabled: true } },
                        include: { locale: { select: { code: true } } },
                    },
                },
            });
            return this.mapLocaleData(model, modelName);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getModelWithCurrentLocaleWhere(modelName, where, locale) {
        try {
            const model = await this.prismaService[modelName].findUnique({
                where,
                include: {
                    [this.getTableNameTranslations(modelName)]: {
                        where: { locale: { code: locale } },
                        include: { locale: { select: { code: true } } },
                    },
                },
            });
            return (0, api_1.itemTranslations)(this.getTableNameTranslations(modelName), model);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getModelWithLocale(modelName, id) {
        try {
            const model = await this.prismaService[modelName].findUnique({
                where: { id },
                include: {
                    [this.getTableNameTranslations(modelName)]: {
                        where: { locale: { enabled: true } },
                        include: { locale: { select: { code: true } } },
                    },
                },
            });
            return this.mapLocaleData(model, modelName);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    mapLocaleData(model, modelName) {
        const localeData = model[this.getTableNameTranslations(modelName)].reduce((acc, item) => {
            const localeCode = item.locale.code;
            const strings = Object.entries(item)
                .filter(([key, value]) => typeof value === 'string')
                .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
            acc[localeCode] = strings;
            return acc;
        }, {});
        return {
            ...model,
            locale: localeData,
        };
    }
    handleError(error) {
        if (error.message.includes('Unique constraint failed')) {
            throw new common_1.BadRequestException('Data already exists.');
        }
        else {
            throw new common_1.BadRequestException(error);
        }
    }
    async listModelWithLocale(locale, modelName, paginationParams, where = {}, include = {}) {
        try {
            const fields = this.prismaService.getFields(modelName);
            let OR = [];
            if (fields) {
                OR = this.prismaService.createInsensitiveSearch(fields, paginationParams);
            }
            return this.paginationService.paginate(this.prismaService[modelName], paginationParams, {
                where: {
                    ...where,
                    OR,
                },
                include: {
                    [this.getTableNameTranslations(modelName)]: {
                        where: { locale: { code: locale } },
                        include: { locale: { select: { code: true } } },
                    },
                    ...include,
                },
            }, this.getTableNameTranslations(modelName));
        }
        catch (error) {
            if (error.message.includes('Unique constraint failed')) {
                throw new common_1.BadRequestException('Data already exists.');
            }
            else {
                throw new common_1.BadRequestException(error.message || 'An error occurred.');
            }
        }
    }
};
exports.LocaleService = LocaleService;
exports.LocaleService = LocaleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => api_prisma_1.PrismaService))),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => api_pagination_1.PaginationService))),
    __metadata("design:paramtypes", [api_prisma_1.PrismaService,
        api_pagination_1.PaginationService])
], LocaleService);
//# sourceMappingURL=locale.service.js.map