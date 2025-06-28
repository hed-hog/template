"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDatabase = void 0;
const abstract_database_1 = require("./abstract.database");
const database_1 = require("./database");
class PostgresDatabase extends abstract_database_1.AbstractDatabase {
    host;
    user;
    password;
    database;
    port;
    constructor(host, user, password, database, port) {
        super(database_1.Database.POSTGRES, host, user, password, database, port);
        this.host = host;
        this.user = user;
        this.password = password;
        this.database = database;
        this.port = port;
    }
}
exports.PostgresDatabase = PostgresDatabase;
//# sourceMappingURL=postgres.database.js.map