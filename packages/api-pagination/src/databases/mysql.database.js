"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySQLDatabase = void 0;
const abstract_database_1 = require("./abstract.database");
const database_1 = require("./database");
class MySQLDatabase extends abstract_database_1.AbstractDatabase {
    host;
    user;
    password;
    database;
    port;
    constructor(host, user, password, database, port) {
        super(database_1.Database.MYSQL, host, user, password, database, port);
        this.host = host;
        this.user = user;
        this.password = password;
        this.database = database;
        this.port = port;
    }
}
exports.MySQLDatabase = MySQLDatabase;
//# sourceMappingURL=mysql.database.js.map