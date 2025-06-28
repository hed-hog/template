"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PaginationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationService = void 0;
const api_1 = require("@hed-hog/api");
const common_1 = require("@nestjs/common");
const pagination_constants_1 = require("./constants/pagination.constants");
const databases_1 = require("./databases");
const patination_enums_1 = require("./enums/patination.enums");
let PaginationService = PaginationService_1 = class PaginationService {
    logger = new common_1.Logger(PaginationService_1.name);
    db = null;
    async paginate(model, paginationParams, customQuery, translationKey) {
        try {
            if (!model) {
                throw new common_1.BadRequestException('Model is required');
            }
            const page = Number(paginationParams.page || pagination_constants_1.DEFAULT_PAGE);
            const pageSize = Number(paginationParams.pageSize || pagination_constants_1.DEFAULT_PAGE_SIZE);
            const search = paginationParams.search || null;
            const sortField = paginationParams.sortField || null;
            const sortOrder = paginationParams.sortOrder || patination_enums_1.PageOrderDirection.Asc;
            const fields = paginationParams.fields
                ? paginationParams.fields.split(',')
                : null;
            if (page < 1 || pageSize < 1) {
                throw new common_1.BadRequestException('Page and pageSize must be greater than 0');
            }
            let selectCondition = undefined;
            let sortOrderCondition = {
                id: paginationParams.sortOrder || patination_enums_1.PageOrderDirection.Asc,
            };
            if (sortField) {
                const invalid = this.isInvalidField(sortField, model);
                let localeInvalid = false;
                if (invalid) {
                    localeInvalid = this.isInvalidLocaleField(sortField, model);
                    if (localeInvalid) {
                        this.logger.error(`Invalid field: ${sortField}`);
                        throw new common_1.BadRequestException(`Invalid field: ${sortField}. Valid columns are: ${this.extractFieldNames(model).join(', ')}`);
                    }
                    else {
                        sortOrderCondition = {
                            [`${model.name}_locale`]: { [sortField]: sortOrder },
                        };
                    }
                }
                else {
                    sortOrderCondition = { [sortField]: sortOrder };
                }
            }
            if (search) {
                if (typeof search !== 'string') {
                    this.logger.error('Search must be a string');
                    throw new common_1.BadRequestException('Search must be a string');
                }
            }
            if (fields) {
                const invalidFields = this.isInvalidFields(fields, model);
                if (invalidFields) {
                    this.logger.error(`Invalid fields: ${fields.join(', ')}. Valid columns are: ${this.extractFieldNames(model).join(', ')}`);
                    throw new common_1.BadRequestException(`Invalid fields: ${fields.join(', ')}. Valid columns are: ${this.extractFieldNames(model).join(', ')}`);
                }
                selectCondition = fields.reduce((acc, field) => {
                    acc[field] = true;
                    return acc;
                }, {});
            }
            const skip = page > 0 ? pageSize * (page - 1) : 0;
            if (customQuery.where &&
                customQuery.where.OR &&
                customQuery.where.OR.length === 0) {
                delete customQuery.where.OR;
            }
            const query = {
                select: selectCondition,
                where: customQuery?.where || {},
                orderBy: sortOrderCondition,
                take: pageSize,
                skip,
            };
            if (customQuery?.include) {
                query.include = customQuery?.include;
                delete query.select;
            }
            let [total, data] = await Promise.all([
                model.count({ where: customQuery?.where || {} }),
                model.findMany(query),
            ]);
            const lastPage = Math.ceil(total / pageSize);
            if (translationKey) {
                data = data.map((item) => {
                    return (0, api_1.itemTranslations)(translationKey, item);
                });
            }
            return {
                total,
                lastPage,
                page,
                pageSize,
                prev: page > 1 ? page - 1 : null,
                next: page < lastPage ? page + 1 : null,
                data,
            };
        }
        catch (error) {
            this.logger.error('Pagination Error:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Failed to paginate: ${error}`);
        }
    }
    extractFieldNames(model) {
        const fieldNames = [];
        const fields = model.fields;
        for (const key in fields) {
            if (fields && fields.hasOwnProperty(key)) {
                fieldNames.push(key);
            }
        }
        return fieldNames;
    }
    isInvalidField(sortField, model) {
        return model && model.fields ? !model.fields[sortField] : true;
    }
    isInvalidLocaleField(sortField, model) {
        const fields = model['$parent'][`${model.name}_locale`].fields;
        return model && fields ? !fields[sortField] : true;
    }
    isInvalidFields(fields, model) {
        return !fields.every((field) => model.fields ? model && model.fields[field] : false);
    }
    isInvalidLocaleFields(fields, model) {
        const localeFields = model['$parent'][`${model.name}_locale`].fields;
        return !fields.every((field) => localeFields ? !localeFields[field] : false);
    }
    async getDb(model) {
        const { DATABASE_URL, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, } = model['$parent']._engine.config.env;
        const type = DATABASE_URL.split(':')[0];
        this.db = databases_1.DatabaseFactory.create(type === 'mysql' ? databases_1.Database.MYSQL : databases_1.Database.POSTGRES, DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE, Number(DB_PORT));
        return this.db;
    }
    async getBuilder(model, tableName, query, builder) {
        const db = await this.getDb(model);
        if (!builder) {
            builder = {
                joinTables: [],
                select: [],
                where: [],
                order: [],
                join: [],
                from: db.getColumnNameWithScaping(tableName),
            };
        }
        if (query.orderBy) {
            for (const key in query.orderBy) {
                if (typeof query.orderBy[key] === 'object') {
                    if (!builder.joinTables.includes(key)) {
                        builder.joinTables.push(key);
                        const foreignKey = await db.getColumnNameFromRelation(tableName, `${tableName}_locale`);
                        const primaryKeys = await db.getPrimaryKeys(tableName);
                        if (primaryKeys.length !== 1) {
                            throw new Error('Only single primary key is supported');
                        }
                        const primaryKey = primaryKeys[0];
                        builder.join.push(`LEFT JOIN ${db.getColumnNameWithScaping(key)} ON ${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(foreignKey)} = ${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(primaryKey)}`);
                        for (const k in query.orderBy[key]) {
                            builder.order.push(`${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(k)} ${query.orderBy[key][k]}`);
                        }
                    }
                }
            }
        }
        if (query.select) {
            builder.select = [
                ...builder.select,
                ...Object.keys(query.select).map((key) => `${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(key)}`),
            ];
            for (const key in query.select) {
                if (typeof query.select[key] === 'object') {
                    builder = await this.getBuilder(model, key, query.select[key], builder);
                }
            }
        }
        else if (query.include) {
            builder.select = [
                ...builder.select,
                `${db.getColumnNameWithScaping(tableName)}.*`,
            ];
            for (const key in query.include) {
                if (typeof query.include[key] === 'object') {
                    if (!builder.joinTables.includes(key)) {
                        builder.joinTables.push(key);
                        const foreignKey = await db.getColumnNameFromRelation(tableName, key);
                        const primaryKeys = await db.getPrimaryKeys(tableName);
                        const primaryKey = primaryKeys[0];
                        builder.join.push(`LEFT JOIN ${db.getColumnNameWithScaping(key)} ON ${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(foreignKey)} = ${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(primaryKey)}`);
                        builder = await this.getBuilder(model, key, query.include[key], builder);
                    }
                }
            }
        }
        if (query.where) {
            for (const key in query.where) {
                if (typeof query.where[key] === 'object') {
                    if (!builder.joinTables.includes(key)) {
                        builder.joinTables.push(key);
                        const foreignKey = await db.getColumnNameFromRelation(key, tableName);
                        const primaryKeys = await db.getPrimaryKeys(key);
                        builder.join.push(`LEFT JOIN ${db.getColumnNameWithScaping(key)} ON ${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(primaryKeys[0])} = ${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(foreignKey)}`);
                        for (const k in query.where[key]) {
                            builder.where.push(`${db.getColumnNameWithScaping(key)}.${db.getColumnNameWithScaping(k)} = ${databases_1.AbstractDatabase.addSimpleQuotes(query.where[key][k])}`);
                        }
                    }
                }
                else {
                    builder.where.push(`${db.getColumnNameWithScaping(tableName)}.${db.getColumnNameWithScaping(key)} = ${databases_1.AbstractDatabase.addSimpleQuotes(query.where[key])}`);
                }
            }
        }
        return builder;
    }
    async query(model, query) {
        const db = await this.getDb(model);
        const builder = await this.getBuilder(model, model.name, query, null);
        const sql = [];
        sql.push(`SELECT ${builder.select.join(', ')}`);
        sql.push(`FROM ${builder.from}`);
        if (builder.join.length)
            sql.push(builder.join.join(' '));
        if (builder.where.length)
            sql.push(`WHERE ${builder.where.join(' AND ')}`);
        if (builder.order.length)
            sql.push(`ORDER BY ${builder.order.join(', ')}`);
        if (query.take >= 0 && query.skip >= 0)
            sql.push(db.getLimit(query.take, query.skip));
        const result = await db.query(sql.join(' '));
        return result;
    }
};
exports.PaginationService = PaginationService;
exports.PaginationService = PaginationService = PaginationService_1 = __decorate([
    (0, common_1.Injectable)()
], PaginationService);
//# sourceMappingURL=pagination.service.js.map