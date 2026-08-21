export type PaginatedResult<T> = {
  total: number;
  lastPage: number;
  page: number;
  pageSize: number;
  prev: number | null;
  next: number | null;
  data: T[];
};
