"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pagination = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_constants_1 = require("../constants/pagination.constants");
const pagination_dto_1 = require("../dto/pagination.dto");
const patination_enums_1 = require("../enums/patination.enums");
exports.Pagination = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const defaultOptions = {
        page: pagination_constants_1.DEFAULT_PAGE,
        pageSize: pagination_constants_1.DEFAULT_PAGE_SIZE,
        search: '',
        sortField: 'id',
        sortOrder: patination_enums_1.PageOrderDirection.Asc,
        fields: '',
    };
    const requestData = {
        ...defaultOptions,
        ...(request.body || {}),
        ...(request.query || {}),
    };
    const { page = defaultOptions.page, pageSize = defaultOptions.pageSize, search = defaultOptions.search, sortField = defaultOptions.sortField, sortOrder = defaultOptions.sortOrder, fields = defaultOptions.fields, } = requestData;
    const validSortOrder = Object.values(patination_enums_1.PageOrderDirection).includes(sortOrder)
        ? sortOrder
        : defaultOptions.sortOrder;
    const finalData = {
        page,
        pageSize,
        search,
        sortField,
        sortOrder: validSortOrder,
        fields,
    };
    const paginationDtoInstance = (0, class_transformer_1.plainToClass)(pagination_dto_1.PaginationDTO, finalData);
    const errors = (0, class_validator_1.validateSync)(paginationDtoInstance);
    if (errors.length > 0) {
        throw new common_1.BadRequestException('Pagination data is not valid according to PaginationDto: ' +
            errors
                .map((error) => Object.values(error.constraints).join(', '))
                .join(', '));
    }
    if (data) {
        switch (data) {
            case patination_enums_1.PaginationField.Page:
            case patination_enums_1.PaginationField.PageSize:
                return finalData[data] ? +finalData[data] : defaultOptions[data];
            case patination_enums_1.PaginationField.SortOrder:
                return validSortOrder || defaultOptions[data];
            default:
                return finalData[data];
        }
    }
    return finalData;
});
//# sourceMappingURL=pagination.decorator.js.map