"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaService = void 0;
const prisma_schema_parser_1 = require("@loancrate/prisma-schema-parser");
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
let SchemaService = class SchemaService {
    async parse(path) {
        return (0, prisma_schema_parser_1.parsePrismaSchema)(await (0, promises_1.readFile)(path, { encoding: 'utf8' }));
    }
    async stringify(path, data) {
        const formatted = (0, prisma_schema_parser_1.formatAst)(data);
        return (0, promises_1.writeFile)(path, formatted, {
            encoding: 'utf8',
        });
    }
};
exports.SchemaService = SchemaService;
exports.SchemaService = SchemaService = __decorate([
    (0, common_1.Injectable)()
], SchemaService);
//# sourceMappingURL=schema.service.js.map