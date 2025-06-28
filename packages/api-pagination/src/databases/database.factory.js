"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseFactory = void 0;
const database_1 = require("./database");
const postgres_database_1 = require("./postgres.database");
const mysql_database_1 = require("./mysql.database");
class DatabaseFactory {
    static create(type, host, user, password, database, port) {
        switch (type) {
            case database_1.Database.POSTGRES:
                return new postgres_database_1.PostgresDatabase(host, user, password, database, port);
            case database_1.Database.MYSQL:
                return new mysql_database_1.MySQLDatabase(host, user, password, database, port);
            default:
                console.warn(`[WARN] Unsupported Database: ${type}`);
        }
    }
}
exports.DatabaseFactory = DatabaseFactory;
//# sourceMappingURL=database.factory.js.map