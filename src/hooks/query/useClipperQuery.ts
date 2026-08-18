import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';

import getYoutubeChannelCards from '@/api/getYoutube.functions';

const useClipperQuery = () => {
  const serverFn = useServerFn(getYoutubeChannelCards);

  return useQuery({
    queryKey: ['getYoutubeChannelCards'],
    queryFn: () => serverFn(),
    staleTime: 60 * 60 * 1000, // 1시간
    refetchOnWindowFocus: false,
  });
};

export default useClipperQuery;
