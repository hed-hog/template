"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    async onModuleInit() {
        await this.$connect();
    }
    getProvider() {
        return this._engineConfig.activeProvider;
    }
    isPostgres() {
        return this.getProvider() === 'postgresql';
    }
    isMysql() {
        return this.getProvider() === 'mysql';
    }
    createInsensitiveSearch(fields, paginationParams) {
        const searchValue = paginationParams.search;
        const OR = [];
        if (!searchValue) {
            return OR;
        }
        fields.forEach((field) => {
            if (field === 'id' && !isNaN(+searchValue) && +searchValue > 0) {
                OR.push({ id: { equals: +searchValue } });
            }
            else if (field === 'method' &&
                ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(searchValue)) {
                OR.push({ method: { equals: searchValue } });
            }
            else if (field !== 'method') {
                if (typeof searchValue === 'string') {
                    const condition = { [field]: { contains: searchValue } };
                    if (this.isPostgres()) {
                        condition[field].mode = 'insensitive';
                    }
                    OR.push(condition);
                }
            }
        });
        if (!isNaN(+searchValue) && +searchValue > 0) {
            OR.push({ id: { equals: +searchValue } });
        }
        return OR;
    }
    getFields(modelName) {
        const fields = this[modelName]?.fields
            ? Object.keys(this[modelName].fields)
            : null;
        return fields;
    }
    getValidData(modelName, data) {
        const validData = {};
        for (const fieldName of this.getFields(modelName)) {
            validData[fieldName] = data[fieldName];
        }
        return validData;
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
//# sourceMappingURL=prisma.service.js.map