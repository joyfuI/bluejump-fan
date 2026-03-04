import { createServerFn } from '@tanstack/react-start';

import getYoutubeChannelCards from '@/helpers/youtube.server';

const getYoutube = createServerFn({ method: 'GET' })
  .inputValidator((data: { channelIds: string[] }) => data)
  .handler(async ({ data }) => getYoutubeChannelCards(data.channelIds));

export default getYoutube;
