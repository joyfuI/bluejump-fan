import { useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';

import type { GetCafeArticlesResponse } from '@/api/getCafeArticles';
import getCafeArticles, { REVALIDATE } from '@/api/getCafeArticles';
import { MEMBERS } from '@/data/constants';

const useCafeQuery = () => {
  return useQueries({
    queries: MEMBERS.flatMap((member) => {
      const { cafeId, cafeMenuIds } = member;
      if (!cafeId || !cafeMenuIds) {
        return [];
      }
      return cafeMenuIds.map((cafeMenuId) => ({
        queryKey: ['getCafeArticles', cafeId, cafeMenuId],
        queryFn: () => getCafeArticles(cafeId, cafeMenuId),
        staleTime: REVALIDATE * 1000,
        refetchInterval: REVALIDATE * 1000,
      }));
    }),
    combine: (results) => ({
      ...results[0],
      data: results
        .reduce<GetCafeArticlesResponse['result']['articleList']>(
          (prev, curr) =>
            curr.data ? prev.concat(curr.data.result.articleList) : prev,
          [],
        )
        .toSorted((a, b) => {
          const aDay = dayjs(a.item.writeDateTimestamp);
          const bDay = dayjs(b.item.writeDateTimestamp);
          return bDay.valueOf() - aDay.valueOf();
        }), // 최근글 순으로 정렬,
    }),
  });
};

export default useCafeQuery;
