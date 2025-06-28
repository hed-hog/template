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
exports.LocaleController = void 0;
const api_pagination_1 = require("@hed-hog/api-pagination");
const api_1 = require("@hed-hog/api");
const common_1 = require("@nestjs/common");
const create_dto_1 = require("./dto/create.dto");
const delete_dto_1 = require("./dto/delete.dto");
const set_enabled_dto_1 = require("./dto/set-enabled.dto");
const update_dto_1 = require("./dto/update.dto");
const locale_decorator_1 = require("./locale.decorator");
const locale_service_1 = require("./locale.service");
let LocaleController = class LocaleController {
    localeService;
    constructor(localeService) {
        this.localeService = localeService;
    }
    async listEnabled(paginationParams, locale) {
        return this.localeService.getEnables(locale, paginationParams);
    }
    async getTranslations(localeCode, namespace) {
        return this.localeService.getTranslations(localeCode, namespace);
    }
    async list(locale, paginationParams) {
        return this.localeService.list(locale, paginationParams);
    }
    async get(id) {
        return this.localeService.get(id);
    }
    async create(data) {
        return this.localeService.create(data);
    }
    async update(id, data) {
        return this.localeService.update({
            id,
            data,
        });
    }
    async setEnabled({ codes }) {
        return this.localeService.setEnabled(codes);
    }
    async delete(data) {
        return this.localeService.delete(data);
    }
};
exports.LocaleController = LocaleController;
__decorate([
    (0, api_1.Public)(),
    (0, common_1.Get)('system/enabled'),
    __param(0, (0, api_pagination_1.Pagination)()),
    __param(1, (0, locale_decorator_1.Locale)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "listEnabled", null);
__decorate([
    (0, api_1.Public)(),
    (0, common_1.Get)(':localeCode/:namespace'),
    __param(0, (0, common_1.Param)('localeCode')),
    __param(1, (0, common_1.Param)('namespace')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "getTranslations", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, locale_decorator_1.Locale)()),
    __param(1, (0, api_pagination_1.Pagination)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_dto_1.CreateDTO]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_dto_1.UpdateDTO]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [set_enabled_dto_1.SetEnabledDTO]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "setEnabled", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_dto_1.DeleteDTO]),
    __metadata("design:returntype", Promise)
], LocaleController.prototype, "delete", null);
exports.LocaleController = LocaleController = __decorate([
    (0, api_1.Role)(),
    (0, common_1.Controller)('locale'),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => locale_service_1.LocaleService))),
    __metadata("design:paramtypes", [locale_service_1.LocaleService])
], LocaleController);
//# sourceMappingURL=locale.controller.js.map