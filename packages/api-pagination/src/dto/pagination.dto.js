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
exports.PaginationDTO = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const patination_enums_1 = require("../enums/patination.enums");
class PaginationDTO {
    page;
    pageSize;
    search;
    sortField;
    sortOrder;
    fields;
}
exports.PaginationDTO = PaginationDTO;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)({ message: 'page must be an integer' }),
    __metadata("design:type", Number)
], PaginationDTO.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)({ message: 'pageSize must be an integer' }),
    __metadata("design:type", Number)
], PaginationDTO.prototype, "pageSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'search must be a string' }),
    __metadata("design:type", String)
], PaginationDTO.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'field must be a string' }),
    __metadata("design:type", String)
], PaginationDTO.prototype, "sortField", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'sortOrder must be a string' }),
    (0, class_validator_1.IsEnum)(patination_enums_1.PageOrderDirection, { message: 'sortOrder is not valid' }),
    __metadata("design:type", String)
], PaginationDTO.prototype, "sortOrder", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'fields must be a string' }),
    __metadata("design:type", String)
], PaginationDTO.prototype, "fields", void 0);
//# sourceMappingURL=pagination.dto.js.map