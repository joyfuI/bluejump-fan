import dayjs from 'dayjs';

import chunk from '@/utils/chunk';
import fetchJson from '@/utils/fetchJson';

export type YoutubeChannelCard = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  videoPublishedAt: string;
};
type ChannelListResponse = {
  kind: 'youtube#channelListResponse';
  etag: string;
  nextPageToken: string;
  prevPageToken: string;
  pageInfo: { totalResults: number; resultsPerPage: number };
  items: {
    kind: 'youtube#channel';
    etag: string;
    id: string;
    snippet: {
      title: string;
      description: string;
      customUrl: string;
      publishedAt: string;
      thumbnails: Record<
        string,
        { url: string; width: number; height: number }
      >;
      defaultLanguage: string;
      localized: { title: string; description: string };
      country: string;
    };
    contentDetails: {
      relatedPlaylists: { likes: string; favorites: string; uploads: string };
    };
    statistics: {
      viewCount: number;
      subscriberCount: number;
      hiddenSubscriberCount: boolean;
      videoCount: number;
    };
  }[];
};
type PlaylistItemListResponse = {
  kind: 'youtube#playlistItemListResponse';
  etag: string;
  nextPageToken: string;
  prevPageToken: string;
  pageInfo: { totalResults: number; resultsPerPage: number };
  items: {
    kind: 'youtube#playlistItem';
    etag: string;
    contentDetails: {
      videoId: string;
      startAt: string;
      endAt: string;
      note: string;
      videoPublishedAt: string;
    };
  }[];
};

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const getChannels = (apiKey: string, channelIds: string[]) => {
  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  Object.entries({
    part: 'contentDetails,id,snippet,statistics',
    id: channelIds.join(','),
    hl: 'ko',
    maxResults: Math.min(50, channelIds.length),
    key: apiKey,
  }).forEach(([k, v]) => {
    url.searchParams.set(k, v.toString());
  });
  return fetchJson<ChannelListResponse>(url);
};

const getPlaylistItems = (apiKey: string, playlistId: string) => {
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  Object.entries({
    part: 'contentDetails',
    playlistId,
    maxResults: 1,
    key: apiKey,
  }).forEach(([k, v]) => {
    url.searchParams.set(k, v.toString());
  });
  return fetchJson<PlaylistItemListResponse>(url);
};

const getYoutubeChannelCards = async (
  channelIds: string[],
): Promise<YoutubeChannelCard[]> => {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('Missing env: YOUTUBE_DATA_API_KEY');
  }

  // channels.list는 maxResults가 최대 50이라 쪼갬
  const batches = chunk(channelIds, 50);
  const channelItems = (
    await Promise.all(batches.map((batche) => getChannels(apiKey, batche)))
  ).flatMap((data) => data.items);

  // playlistItems.list로 채널별 uploads playlist에서 마지막 영상 가져오기
  const items = await Promise.all(
    channelItems.map(async (channelItem) => {
      const data = await getPlaylistItems(
        apiKey,
        channelItem.contentDetails.relatedPlaylists.uploads,
      );
      return { ...channelItem, playlistItems: data };
    }),
  );

  const cards: YoutubeChannelCard[] = items.map((item) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail:
      item.snippet.thumbnails.high.url ??
      item.snippet.thumbnails.medium.url ??
      item.snippet.thumbnails.default.url,
    subscriberCount: item.statistics.subscriberCount,
    videoCount: item.statistics.videoCount,
    viewCount: item.statistics.viewCount,
    videoPublishedAt:
      item.playlistItems.items[0]?.contentDetails.videoPublishedAt,
  }));

  // 최신 업로드 내림차순 정렬
  cards.sort((a, b) => {
    const aDay = dayjs(a.videoPublishedAt);
    const bDay = dayjs(b.videoPublishedAt);
    return bDay.valueOf() - aDay.valueOf();
  });

  return cards;
};

export default getYoutubeChannelCards;
