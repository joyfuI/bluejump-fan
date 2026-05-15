import { createFileRoute } from '@tanstack/react-router';

import getBluejumpNews from '@/api/getBluejumpNews';

export const Route = createFileRoute('/bluejump-news.xml')({
  server: {
    handlers: {
      GET: async () => {
        const res = await getBluejumpNews();
        const { data } = res;
        const today = new Date();

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>블루점프의 최신 뉴스</title>
    <link>https://bluejump.co.kr/news</link>
    <description>저희 블루 점프에 관한 최신 소식과, 다가오는 이벤트 및 그 밖의 정보를 확인하세요!</description>
    <language>ko-KR</language>
    <pubDate>${today.toUTCString()}</pubDate>
${data
  .map(
    (item) => `    <item>
      <title>${item.title ?? item.title_en}</title>
      <link>https://bluejump.co.kr/news/${item.id}</link>
      <description>${item.content ?? item.content_en}</description>
      <category>${item.category}</category>
      <author>${item.creator}</author>
      <pubDate>${new Date(item.created_at).toUTCString()}</pubDate>
      <guid>https://bluejump.co.kr/news/${item.id}</guid>
      <media:thumbnail url="${item.thumbnail_url}" />
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>`;

        return new Response(rss, {
          headers: {
            'Content-Type': 'application/rss+xml; charset=UTF-8',
            'Cache-Control':
              'public, s-maxage=600, stale-while-revalidate=36000',
          },
        });
      },
    },
  },
});
