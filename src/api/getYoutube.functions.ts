import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';

import { CLIPPERS } from '@/data/constants';
import getYoutubeChannelCards from '@/helpers/youtube.server';

const getYoutube = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  );
  return getYoutubeChannelCards(CLIPPERS);
});

export default getYoutube;
