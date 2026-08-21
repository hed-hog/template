import { useApp, useQuery } from '@hed-hog/next-app-provider';

interface UseWidgetDataOptions<T, R = T> {
  endpoint: string;
  queryKey: string;
  enabled?: boolean;
  select?: (data: T) => R;
}

interface UseWidgetDataReturn<R> {
  data: R | undefined;
  isLoading: boolean;
  isError: boolean;
  isAccessDenied: boolean;
  error: any;
}

export function useWidgetData<T extends {} = any, R = T>({
  endpoint,
  queryKey,
  enabled = true,
  select,
}: UseWidgetDataOptions<T, R>): UseWidgetDataReturn<R> {
  const { request } = useApp();

  const { data, isLoading, isFetching, isPending, isError, error } =
    useQuery<T>({
      queryKey: [queryKey],
      enabled,
      retry: false,
      queryFn: async () => {
        try {
          const { data } = await request<T>({
            url: endpoint,
            method: 'GET',
          });
          return data;
        } catch (error: any) {
          throw error;
        }
      },
    });

  const isAccessDenied =
    isError &&
    ((error as any)?.response?.status === 401 ||
      (error as any)?.status === 401 ||
      (error as any)?.message?.includes('401') ||
      (error as any)?.message?.includes('Unauthorized'));

  const loading = isPending || isLoading || isFetching;

  const selected =
    data !== undefined && select ? select(data) : (data as unknown as R);

  return {
    data: selected,
    isLoading: loading,
    isError,
    isAccessDenied,
    error,
  };
}
