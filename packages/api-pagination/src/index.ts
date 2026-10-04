export * from './constants/pagination.constants';
export * from './decorator/pagination.decorator';
export * from './dto/pagination.dto';
export * from './enums/patination.enums';
export * from './pagination.module';
export * from './pagination.service';
export type * from './types/pagination.types';

/**
 * Re-export do descritor de ordenação, que mora em `@hed-hog/api-types` porque
 * lá é TypeScript puro (este pacote arrasta Nest, pg e typeorm, que não podem
 * entrar no bundle do admin).
 *
 * Reexportar aqui é o que evita 26 edições de package.json: toda library já
 * depende de `api-pagination`, e nenhuma precisa declarar `api-types` só para
 * declarar seus campos ordenáveis.
 */
export {
  defineSortable,
  type NormalizedSort,
  type Sortable,
  type SortableOptions,
  type SortFieldMap,
  type SortFieldSpec,
  type SortInput,
  type SortOrder as SortableOrder,
} from '@hed-hog/api-types';
