import { useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';

import type { GetBoardResponse } from '@/api/getBoard';
import getBoard, { REVALIDATE } from '@/api/getBoard';
import { MEMBERS } from '@/data/constants';

type UseSoopQueryOptions = { onlyMember?: boolean };

const useSoopQuery = (options?: UseSoopQueryOptions) => {
  return useQueries({
    queries: MEMBERS.map((member) => ({
      queryKey: ['getBoard', member.id],
      queryFn: () => getBoard(member.id),
      staleTime: REVALIDATE * 1000,
      refetchInterval: REVALIDATE * 1000,
    })),
    combine: (results) => ({
      ...results[0],
      data: results
        .reduce<GetBoardResponse['data']>(
          (prev, curr, index) =>
            curr.data
              ? prev.concat(
                  curr.data.data.filter((item) =>
                    options?.onlyMember
                      ? item.user_id === MEMBERS[index].id
                      : true,
                  ),
                )
              : prev,
          [],
        )
        .toSorted((a, b) => {
          const aDay = dayjs(a.reg_date, 'YYYY-MM-DD HH:mm:ss');
          const bDay = dayjs(b.reg_date, 'YYYY-MM-DD HH:mm:ss');
          return bDay.valueOf() - aDay.valueOf();
        }), // 최근글 순으로 정렬,
    }),
  });
};

export default useSoopQuery;
