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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaleMiddleware = void 0;
const api_prisma_1 = require("@hed-hog/api-prisma");
const common_1 = require("@nestjs/common");
let LocaleMiddleware = class LocaleMiddleware {
    prisma;
    languages = [];
    constructor(prisma) {
        this.prisma = prisma;
    }
    async use(req, _res, next) {
        const locale = req.headers['accept-language'] || 'en-US';
        let code = locale.split(',')[0].split('-')[0];
        if (!this.languages.length) {
            const locale = await this.prisma.locale.findMany({
                select: {
                    code: true,
                },
            });
            for (const l of locale) {
                this.languages.push(l.code);
            }
        }
        if (!this.languages.includes(code)) {
            code = 'en';
        }
        req['locale'] = code;
        next();
    }
};
exports.LocaleMiddleware = LocaleMiddleware;
exports.LocaleMiddleware = LocaleMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [api_prisma_1.PrismaService])
], LocaleMiddleware);
//# sourceMappingURL=locale.middleware.js.map