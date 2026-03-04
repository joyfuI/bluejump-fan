import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';

import getYoutubeChannelCards from '@/api/getYoutube.functions';
import { CLIPPERS } from '@/data/constants';

const useClipperQuery = () => {
  const serverFn = useServerFn(getYoutubeChannelCards);
  const clipperIds = CLIPPERS.toSorted();

  return useQuery({
    queryKey: ['getYoutubeChannelCards', clipperIds],
    queryFn: () => serverFn({ data: { channelIds: clipperIds } }),
    staleTime: 60 * 60 * 1000, // 1시간
    refetchOnWindowFocus: false,
  });
};

export default useClipperQuery;
