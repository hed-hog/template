"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractDatabase = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("./database");
const PlatformTools_1 = require("typeorm/platform/PlatformTools");
class AbstractDatabase {
    type;
    host;
    user;
    password;
    database;
    port;
    client = null;
    foreignKeys = {};
    foreignKeysByTable = {};
    primaryKeys = {};
    columnNameFromRelation = {};
    relationN2N = {};
    relation1N = {};
    columnComment = {};
    tableHasColumnOrder = {};
    eventEmitter = new PlatformTools_1.EventEmitter();
    autoClose = true;
    constructor(type, host, user, password, database, port) {
        this.type = type;
        this.host = host;
        this.user = user;
        this.password = password;
        this.database = database;
        this.port = port;
    }
    getDataSource() {
        return new typeorm_1.DataSource({
            type: this.type,
            host: this.host,
            port: this.port,
            username: this.user,
            password: this.password,
            database: this.database,
            synchronize: true,
            logging: false,
            entities: [],
            subscribers: [],
            migrations: [],
        });
    }
    disableAutoClose() {
        this.autoClose = false;
    }
    close() {
        return this.client?.end();
    }
    on(event, listener) {
        return this.eventEmitter.on(event, listener);
    }
    getArrayType(values) {
        return [...new Set(values.map((value) => typeof value))][0];
    }
    getWhereWithIn(columnName, operator, values) {
        switch (this.type) {
            case database_1.Database.POSTGRES:
                if (operator === 'in') {
                    return `${this.getColumnNameWithScaping(columnName)} = ANY(?::${this.getArrayType(values) === 'number' ? 'int' : 'text'}[])`;
                }
                else {
                    return `${this.getColumnNameWithScaping(columnName)} <> ALL(?::${this.getArrayType(values) === 'number' ? 'int' : 'text'}[])`;
                }
            case database_1.Database.MYSQL:
                return `${this.getColumnNameWithScaping(columnName)} ${operator === 'in' ? 'IN' : 'NOT IN'}(${values.map((value) => AbstractDatabase.addSimpleQuotes(value)).join(', ')})`;
        }
    }
    static addSimpleQuotes(value) {
        if (typeof value === 'string') {
            return `'${value}'`;
        }
        return value;
    }
    replacePlaceholders(query) {
        let index = 1;
        return query.replace(/\?/g, () => {
            return `$${index++}`;
        });
    }
    getColumnNameWithScaping(columnName) {
        switch (this.type) {
            case database_1.Database.POSTGRES:
                return `"${columnName}"`;
            case database_1.Database.MYSQL:
                return `\`${columnName}\``;
        }
    }
    getLimit(offset, limit) {
        switch (this.type) {
            case database_1.Database.POSTGRES:
                return `LIMIT ${offset} OFFSET ${limit}`;
            case database_1.Database.MYSQL:
                return `LIMIT ${offset}, ${limit}`;
        }
    }
    getTableNameFromQuery(query) {
        const match = query.match(/INSERT INTO\s+([`"]?[\w-]+[`"]?)/i);
        if (match && match[1]) {
            return match[1].replace(/[`"]/g, '');
        }
        return null;
    }
    async hasTableColumnOrder(tableName) {
        if (this.tableHasColumnOrder[tableName]) {
            return this.tableHasColumnOrder[tableName];
        }
        return (this.tableHasColumnOrder[tableName] =
            (await this.getColumnComment(tableName, 'order')) === 'order');
    }
    async getColumnComment(tableName, columnName) {
        if (this.columnComment[`${tableName}.${columnName}`]) {
            return this.columnComment[`${tableName}.${columnName}`];
        }
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg = await this.query(`SELECT a.attname AS column_name,
                col_description(a.attrelid, a.attnum) AS column_comment
          FROM pg_class AS c
          JOIN pg_attribute AS a ON a.attrelid = c.oid
          WHERE c.relname = ?
            AND a.attname = ?;`, [tableName, columnName]);
                return resultPg.length > 0
                    ? (this.columnComment[`${tableName}.${columnName}`] =
                        resultPg[0].column_comment)
                    : '';
            case database_1.Database.MYSQL:
                const resultMysql = await this.query(`SELECT COLUMN_NAME, COLUMN_COMMENT
          FROM information_schema.COLUMNS
          WHERE TABLE_NAME = ?
            AND COLUMN_NAME = ?;`, [tableName, columnName]);
                return resultMysql.length > 0
                    ? (this.columnComment[`${tableName}.${columnName}`] =
                        resultMysql[0].COLUMN_COMMENT)
                    : '';
        }
    }
    async getTableNameFromForeignKey(tableName, foreignKey) {
        if (this.foreignKeys[`${tableName}.${foreignKey}`]) {
            return this.foreignKeys[`${tableName}.${foreignKey}`];
        }
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg = await this.query(`SELECT
            ccu.table_name
          FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ? AND kcu.column_name = ?;`, [tableName, foreignKey]);
                if (resultPg.length === 0) {
                    throw new Error(`Foreign key ${tableName}.${foreignKey} not found in database.`);
                }
                return (this.foreignKeys[`${tableName}.${foreignKey}`] =
                    resultPg[0].table_name);
            case database_1.Database.MYSQL:
                const resultMysql = await this.query(`SELECT kcu.REFERENCED_TABLE_NAME as table_name
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            JOIN information_schema.table_constraints AS tc
            ON tc.constraint_name = kcu.constraint_name
                          AND tc.table_schema = kcu.table_schema
            WHERE kcu.TABLE_NAME = ? AND kcu.COLUMN_NAME = ? AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'`, [tableName, foreignKey]);
                if (resultMysql.length === 0) {
                    throw new Error(`Foreign key ${tableName}.${foreignKey} not found in database.`);
                }
                return (this.foreignKeys[`${tableName}.${foreignKey}`] =
                    resultMysql[0].table_name);
        }
    }
    shouldHandleReturning(options) {
        return options?.returning !== undefined;
    }
    isReturningSingleField(options) {
        return (options?.returning instanceof Array && options.returning.length === 1);
    }
    isReturningIdWithoutPrimaryKeys(options) {
        return options?.returning === 'id' && !options.primaryKeys;
    }
    isMissingPrimaryKeys(options) {
        return !options?.primaryKeys;
    }
    hasPrimaryKeys(options) {
        return typeof options?.primaryKeys === 'string';
    }
    hasReturning(options) {
        return typeof options?.returning === 'string';
    }
    formatOptions(options) {
        if (options && this.shouldHandleReturning(options)) {
            if (this.isReturningSingleField(options)) {
                options.returning = options.returning[0];
            }
            if (this.isReturningIdWithoutPrimaryKeys(options)) {
                options.primaryKeys = options.returning;
            }
            if (this.isMissingPrimaryKeys(options)) {
                throw new Error('Primary key is required when using returning.');
            }
            if (this.hasPrimaryKeys(options)) {
                options.primaryKeys = [options.primaryKeys];
            }
            if (this.hasReturning(options)) {
                options.returning = [options.returning];
            }
        }
        return options;
    }
    addReturningToQuery(query, options) {
        if (this.type === database_1.Database.POSTGRES &&
            this.shouldHandleReturning(options)) {
            return `${query} RETURNING ${(options?.returning).join(', ')}`;
        }
        return query;
    }
    async getResult(query, result, options) {
        switch (this.type) {
            case database_1.Database.POSTGRES:
                return result.rows;
            case database_1.Database.MYSQL:
                result = result[0];
                if (this.shouldHandleReturning(options)) {
                    const resultArray = [
                        {
                            id: result.insertId,
                        },
                    ];
                    result = resultArray;
                    if ((Array.isArray(options?.returning) &&
                        options.returning.length > 1) ||
                        (options?.returning?.length === 1 &&
                            options?.primaryKeys &&
                            options?.returning[0] !== options?.primaryKeys[0])) {
                        const where = (options?.primaryKeys ?? [])
                            .map((pk) => `${pk} = ?`)
                            .join(' AND ');
                        const selectReturningQuery = `SELECT ${(options?.returning).join(', ')} FROM ${this.getTableNameFromQuery(query)} WHERE ${where}`;
                        const returningResult = await this.client.query(selectReturningQuery, [resultArray[0].id]);
                        result = returningResult;
                    }
                }
                else if (result?.insertId) {
                    result = [
                        {
                            id: result.insertId,
                        },
                    ];
                }
                return result;
        }
    }
    async getClient() {
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const { Client } = await Promise.resolve().then(() => __importStar(require('pg')));
                this.client = new Client({
                    host: this.host,
                    user: this.user,
                    password: this.password,
                    database: this.database,
                    port: this.port,
                });
                await this.client.connect();
                return this.client;
            case database_1.Database.MYSQL:
                const mysql = await Promise.resolve().then(() => __importStar(require('mysql2/promise')));
                this.client = await mysql.createConnection({
                    host: this.host,
                    user: this.user,
                    password: this.password,
                    database: this.database,
                    port: this.port,
                });
                return this.client;
        }
    }
    async testDatabaseConnection() {
        try {
            switch (this.type) {
                case database_1.Database.POSTGRES:
                case database_1.Database.MYSQL:
                    await this.query('SELECT NOW()');
                    break;
            }
        }
        catch (error) {
            return false;
        }
        return true;
    }
    async getPrimaryKeys(tableName) {
        if (this.primaryKeys[tableName]) {
            return this.primaryKeys[tableName];
        }
        let primaryKeys = [];
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg = await this.query(`SELECT column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          WHERE constraint_type = 'PRIMARY KEY'
          AND tc.table_name = ?`, [tableName]);
                primaryKeys = resultPg.map((row) => row.column_name);
                if (primaryKeys.length > 0) {
                    this.primaryKeys[tableName] = primaryKeys;
                }
                return primaryKeys;
            case database_1.Database.MYSQL:
                const resultMysql = await this.query(`SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'`, [tableName]);
                primaryKeys = resultMysql.map((row) => row.COLUMN_NAME);
                if (primaryKeys.length > 0) {
                    this.primaryKeys[tableName] = primaryKeys;
                }
                return primaryKeys;
        }
    }
    async getForeignKeys(tableName) {
        if (this.foreignKeysByTable[tableName]) {
            return this.foreignKeysByTable[tableName];
        }
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg = await this.query(`SELECT kcu.column_name
          FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ?;`, [tableName]);
                return (this.foreignKeysByTable[tableName] = resultPg.map((row) => row.column_name));
            case database_1.Database.MYSQL:
                const resultMysql = await this.query(`SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_NAME = ? AND CONSTRAINT_NAME != 'PRIMARY'`, [tableName]);
                return (this.foreignKeysByTable[tableName] = resultMysql.map((row) => row.COLUMN_NAME));
        }
    }
    async getColumnNameFromRelation(tableNameOrigin, tableNameDestination) {
        if (this.columnNameFromRelation[`${tableNameOrigin}.${tableNameDestination}`]) {
            return this.columnNameFromRelation[`${tableNameOrigin}.${tableNameDestination}`];
        }
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg = await this.query(`SELECT
            tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = ? AND tc.table_name = ?;`, [tableNameOrigin, tableNameDestination]);
                if (!resultPg.length) {
                    throw new Error(`Foreign key ${tableNameOrigin}.${tableNameDestination} not found in database. [getColumnNameFromRelation]`);
                }
                return (this.columnNameFromRelation[`${tableNameOrigin}.${tableNameDestination}`] = resultPg[0].column_name);
            case database_1.Database.MYSQL:
                const resultMysql = await this.query(`SELECT
            TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM
            INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ? AND TABLE_NAME = ?;`, [tableNameOrigin, tableNameDestination]);
                if (!resultMysql.length) {
                    throw new Error(`Foreign key ${tableNameOrigin}.${tableNameDestination} not found in database.  [getColumnNameFromRelation]`);
                }
                return (this.columnNameFromRelation[`${tableNameOrigin}.${tableNameDestination}`] = resultMysql[0].COLUMN_NAME);
            default:
                throw new Error(`Unsupported database type: ${this.type}`);
        }
    }
    async getRelation1N(tableNameOrigin, tableNameDestination) {
        if (this.relation1N[`${tableNameOrigin}.${tableNameDestination}`]) {
            return this.relation1N[`${tableNameOrigin}.${tableNameDestination}`];
        }
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg = await this.query(`SELECT
            tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = ? AND tc.table_name = ?;`, [tableNameOrigin, tableNameDestination]);
                if (!resultPg.length) {
                    throw new Error(`Foreign key ${tableNameOrigin}.${tableNameDestination} not found in database. [getRelation1N]`);
                }
                return (this.relation1N[`${tableNameOrigin}.${tableNameDestination}`] =
                    resultPg[0].column_name);
            case database_1.Database.MYSQL:
                const resultMysql = await this.query(`SELECT
            TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM
            INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ? AND TABLE_NAME = ?;`, [tableNameOrigin, tableNameDestination]);
                if (!resultMysql.length) {
                    throw new Error(`Foreign key ${tableNameOrigin}.${tableNameDestination} not found in database. [getRelation1N]`);
                }
                return (this.relation1N[`${tableNameOrigin}.${tableNameDestination}`] =
                    resultMysql[0].COLUMN_NAME);
        }
    }
    async getRelationN2N(tableNameOrigin, tableNameDestination) {
        if (this.relationN2N[`${tableNameOrigin}.${tableNameDestination}`]) {
            return this.relationN2N[`${tableNameOrigin}.${tableNameDestination}`];
        }
        let tableNameIntermediate = '';
        let columnNameOrigin = '';
        let columnNameDestination = '';
        let primaryKeyDestination = '';
        switch (this.type) {
            case database_1.Database.POSTGRES:
                const resultPg1 = await this.query(`SELECT
            tc.table_name, kcu.column_name
            FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = ?;`, [tableNameOrigin]);
                for (const row of resultPg1) {
                    const resultPg2 = await this.query(`SELECT
                tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
                FROM
                information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ?;`, [row['table_name']]);
                    for (const row2 of resultPg2) {
                        if (row2['foreign_table_name'] === tableNameDestination) {
                            tableNameIntermediate = row['table_name'];
                            columnNameOrigin = row['column_name'];
                            columnNameDestination = row2['column_name'];
                            primaryKeyDestination = row2['foreign_column_name'];
                            break;
                        }
                    }
                }
                return (this.relationN2N[`${tableNameOrigin}.${tableNameDestination}`] =
                    {
                        tableNameIntermediate,
                        columnNameOrigin,
                        columnNameDestination,
                        primaryKeyDestination,
                    });
            case database_1.Database.MYSQL:
                const resultMysql1 = await this.query(`SELECT 
            kcu.TABLE_NAME, 
            kcu.COLUMN_NAME, 
            kcu.REFERENCED_TABLE_NAME AS foreign_table_name, 
            kcu.REFERENCED_COLUMN_NAME AS foreign_column_name
          FROM 
            information_schema.KEY_COLUMN_USAGE AS kcu
          WHERE 
            kcu.REFERENCED_TABLE_NAME = ?
            AND kcu.TABLE_SCHEMA = DATABASE();`, [tableNameOrigin]);
                for (const row of resultMysql1) {
                    const resultMysql2 = await this.query(`SELECT 
              kcu.TABLE_NAME, 
              kcu.COLUMN_NAME, 
              kcu.REFERENCED_TABLE_NAME AS foreign_table_name, 
              kcu.REFERENCED_COLUMN_NAME AS foreign_column_name
            FROM 
              information_schema.KEY_COLUMN_USAGE AS kcu
            WHERE 
              kcu.TABLE_NAME = ?
              AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
              AND kcu.TABLE_SCHEMA = DATABASE();`, [row['TABLE_NAME']]);
                    for (const row2 of resultMysql2) {
                        if (row2['foreign_table_name'] === tableNameDestination) {
                            tableNameIntermediate = row['TABLE_NAME'];
                            columnNameOrigin = row['COLUMN_NAME'];
                            columnNameDestination = row2['COLUMN_NAME'];
                            primaryKeyDestination = row2['foreign_column_name'];
                            break;
                        }
                    }
                }
                return (this.relationN2N[`${tableNameOrigin}.${tableNameDestination}`] =
                    {
                        tableNameIntermediate,
                        columnNameOrigin,
                        columnNameDestination,
                        primaryKeyDestination,
                    });
            default:
                throw new Error(`Unsupported database type: ${this.type}`);
        }
    }
    static parseQueryValue(value) {
        switch (typeof value) {
            case 'number':
            case 'boolean':
                return value;
            default:
                return `'${value}'`;
        }
    }
    static objectToWhereClause(obj) {
        let whereClause = '';
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                whereClause += `${key} ${obj[key].operator} ${AbstractDatabase.parseQueryValue(obj[key].value)}`;
            }
            else {
                whereClause += `${key} = ${AbstractDatabase.parseQueryValue(obj[key])}`;
            }
        }
        return whereClause;
    }
    async transaction(queries) {
        this.eventEmitter.emit('transaction', { queries });
        if (!this.client) {
            await this.getClient();
        }
        const results = [];
        for (let i = 0; i < queries.length; i++) {
            queries[i].options = this.formatOptions(queries[i].options);
            queries[i].query = this.addReturningToQuery(queries[i].query, queries[i].options);
        }
        try {
            switch (this.type) {
                case database_1.Database.POSTGRES:
                    await this.client.query('BEGIN');
                    for (const { query, values, options } of queries) {
                        const resultPg = await this.client.query(this.replacePlaceholders(query), values);
                        results.push(this.getResult(query, resultPg, options));
                    }
                    await this.client.query('COMMIT');
                    break;
                case database_1.Database.MYSQL:
                    await this.client.beginTransaction();
                    for (const { query, values, options } of queries) {
                        const resultMySQL = await this.client.query(query, values);
                        results.push(this.getResult(query, resultMySQL, options));
                    }
                    await this.client.commit();
                    break;
            }
        }
        catch (error) {
            switch (this.type) {
                case database_1.Database.POSTGRES:
                    await this.client.query('ROLLBACK');
                    break;
                case database_1.Database.MYSQL:
                    await this.client.rollback();
                    break;
            }
            throw error;
        }
        finally {
            if (this.autoClose) {
                await this.client?.end();
                this.client = null;
            }
        }
        return results;
    }
    async query(query, values, options) {
        this.eventEmitter.emit('query', { query, values, options });
        if (!this.client) {
            await this.getClient();
        }
        let result;
        options = this.formatOptions(options);
        query = this.addReturningToQuery(query, options);
        try {
            switch (this.type) {
                case database_1.Database.POSTGRES:
                    result = await this.client.query(this.replacePlaceholders(query), values);
                    break;
                case database_1.Database.MYSQL:
                    result = await this.client.query(query, values);
                    break;
            }
        }
        catch (error) {
            console.error({
                error,
                query,
                values,
                options,
            });
            this.eventEmitter.emit('error', { error, query, values, options });
        }
        result = await this.getResult(query, result, options);
        this.eventEmitter.emit('query', { result });
        if (this.autoClose) {
            await this.client?.end();
            this.client = null;
        }
        return result;
    }
}
exports.AbstractDatabase = AbstractDatabase;
//# sourceMappingURL=abstract.database.js.map