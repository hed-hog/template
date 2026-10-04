import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from '../constants/pagination.constants';
import { PaginationDTO } from '../dto/pagination.dto';
import { PageOrderDirection, PaginationField } from '../enums/patination.enums';
import { PaginationParams, PaginationType } from '../types/pagination.types';

export const Pagination = createParamDecorator(
  (data: PaginationField, ctx: ExecutionContext): PaginationType => {
    const request = ctx.switchToHttp().getRequest();

    // Sem `sortField` de propósito: o default 'id' que ficava aqui era copiado
    // para `requestData` e tornava impossível saber se o cliente pediu ordem.
    // Quem define a ordem padrão agora é o service (via `defineSortable` ou
    // `defaultSortField`), que é quem sabe qual ela é.
    const defaultOptions: PaginationType = {
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      search: '',
      sortOrder: PageOrderDirection.Asc,
      fields: '',
    };

    const requestData = {
      ...defaultOptions,
      ...(request.body || {}),
      ...(request.query || {}),
    };

    const {
      page = defaultOptions.page,
      pageSize = defaultOptions.pageSize,
      search = defaultOptions.search,
      sortOrder = defaultOptions.sortOrder,
      fields = defaultOptions.fields,
    } = requestData;

    const validSortOrder = Object.values(PageOrderDirection).includes(sortOrder)
      ? sortOrder
      : defaultOptions.sortOrder;

    // `sortField` só existe quando o cliente realmente pediu. Preenchê-lo com
    // 'id' por omissão — como era feito aqui — apagava a diferença entre "pediu
    // por id" e "não pediu nada", e era por isso que um service só conseguia
    // declarar sua ordem padrão travando o `orderBy`. Metade dos endpoints
    // paginados ignorava o `sortField` do cliente por causa disso.
    const rawSortField = (requestData as Record<string, unknown>).sortField;
    const sortField =
      typeof rawSortField === 'string' && rawSortField.trim().length > 0
        ? rawSortField.trim()
        : undefined;

    const finalData: PaginationParams = {
      page,
      pageSize,
      search,
      sortOrder: validSortOrder,
      fields,
    };

    // A chave é OMITIDA, não posta como `undefined`: `Object.assign({ sortField:
    // 'code' }, paginationParams)` — o padrão de api-locale/locale.service.ts —
    // copia chave própria mesmo com valor `undefined` e sobrescreveria o
    // default do service.
    if (sortField !== undefined) {
      finalData.sortField = sortField;
    }

    const paginationDtoInstance = plainToClass(PaginationDTO, finalData);

    const errors = validateSync(paginationDtoInstance);

    if (errors.length > 0) {
      throw new BadRequestException(
        'Pagination data is not valid according to PaginationDto: ' +
          errors
            .map((error) => Object.values(error.constraints).join(', '))
            .join(', '),
      );
    }

    if (data) {
      switch (data) {
        case PaginationField.Page:
        case PaginationField.PageSize:
          return finalData[data] ? +finalData[data] : defaultOptions[data];
        case PaginationField.SortOrder:
          return validSortOrder || defaultOptions[data];
        default:
          return finalData[data];
      }
    }

    return finalData;
  },
);
