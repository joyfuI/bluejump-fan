import { useQueries } from '@tanstack/react-query';

import type { GetCalendarParams, GetCalendarResponse } from '@/api/getCalendar';
import getCalendar, { REVALIDATE } from '@/api/getCalendar';
import { MEMBERS } from '@/data/constants';

const useCalendarQuery = (params: GetCalendarParams) => {
  return useQueries({
    queries: MEMBERS.map((member) => ({
      queryKey: ['getVodsReview', member.id, params],
      queryFn: () => getCalendar(member.id, params),
      staleTime: REVALIDATE * 1000,
      refetchInterval: REVALIDATE * 1000,
    })),
    combine: (results) => ({
      ...results[0],
      data: results.reduce<
        (GetCalendarResponse['days'][0]['events'][0] & (typeof MEMBERS)[0])[]
      >(
        (prev, curr, index) =>
          curr.data
            ? prev.concat(
                curr.data.days.flatMap((item) =>
                  item.events.map((item2) => ({ ...item2, ...MEMBERS[index] })),
                ),
              )
            : prev,
        [],
      ),
    }),
  });
};

export default useCalendarQuery;
