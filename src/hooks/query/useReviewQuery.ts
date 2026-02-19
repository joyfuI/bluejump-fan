import { useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';

import type { GetVodsReviewResponse } from '@/api/getVodsReview';
import getVodsReview, { REVALIDATE } from '@/api/getVodsReview';
import { MEMBERS } from '@/data/constants';

const useReviewQuery = () => {
  return useQueries({
    queries: MEMBERS.map((member) => ({
      queryKey: ['getVodsReview', member.id],
      queryFn: () => getVodsReview(member.id),
      staleTime: REVALIDATE * 1000,
      refetchInterval: REVALIDATE * 1000,
    })),
    combine: (results) => ({
      ...results[0],
      data: results
        .reduce<GetVodsReviewResponse['data']>(
          (prev, curr) => (curr.data ? prev.concat(curr.data.data) : prev),
          [],
        )
        .toSorted((a, b) => {
          const aDay = dayjs(a.reg_date, 'YYYY-MM-DD HH:mm:ss');
          const bDay = dayjs(b.reg_date, 'YYYY-MM-DD HH:mm:ss');
          return bDay.valueOf() - aDay.valueOf();
        }), // 날짜순으로 정렬
    }),
  });
};

export default useReviewQuery;
