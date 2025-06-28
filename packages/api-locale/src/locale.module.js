"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaleModule = void 0;
const api_pagination_1 = require("@hed-hog/api-pagination");
const api_prisma_1 = require("@hed-hog/api-prisma");
const common_1 = require("@nestjs/common");
const locale_controller_1 = require("./locale/locale.controller");
const locale_middleware_1 = require("./locale/locale.middleware");
const locale_service_1 = require("./locale/locale.service");
let LocaleModule = class LocaleModule {
    configure(consumer) {
        consumer.apply(locale_middleware_1.LocaleMiddleware).forRoutes('*');
    }
};
exports.LocaleModule = LocaleModule;
exports.LocaleModule = LocaleModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => api_prisma_1.PrismaModule),
            (0, common_1.forwardRef)(() => api_pagination_1.PaginationModule),
            (0, common_1.forwardRef)(() => LocaleModule),
        ],
        controllers: [locale_controller_1.LocaleController],
        providers: [locale_service_1.LocaleService],
        exports: [locale_service_1.LocaleService],
    })
], LocaleModule);
//# sourceMappingURL=locale.module.js.map