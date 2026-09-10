import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { GetVodSearchResponse } from '@/api/getVodSearch';
import getVodSearch from '@/api/getVodSearch';

const useTagClipQuery = (keyword: string, ignoreUserIds: string[] = []) => {
  const select = useCallback(
    (data: InfiniteData<GetVodSearchResponse, number>) => {
      const titleNos = new Set<string>();

      return data.pages.map((page) =>
        page.DATA.filter((item) => {
          if (!['NORMAL', 'CLIP', 'CATCH'].includes(item.type)) {
            return false;
          }

          if (
            ignoreUserIds.some(
              (ignoreUserId) => ignoreUserId === item.original_bj,
            )
          ) {
            return false;
          }

          if (titleNos.has(item.title_no)) {
            return false;
          }
          titleNos.add(item.title_no);
          return true;
        }),
      );
    },
    [ignoreUserIds],
  );

  return useInfiniteQuery({
    queryKey: ['getVodSearch', keyword],
    queryFn: ({ pageParam }) =>
      getVodSearch({ keyword, page: pageParam, scope: 'tag' }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.HAS_MORE_LIST ? lastPageParam + 1 : null,
    getPreviousPageParam: (_firstPage, _allPages, firstPageParam) =>
      firstPageParam > 1 ? firstPageParam - 1 : null,
    staleTime: Infinity,
    gcTime: 0,
    select,
  });
};

export default useTagClipQuery;
