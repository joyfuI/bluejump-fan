import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/vod-search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const keyword = requestUrl.searchParams.get('keyword');
        const page = requestUrl.searchParams.get('page');
        const limit = requestUrl.searchParams.get('limit');
        const term = requestUrl.searchParams.get('term');

        const res = await fetch(
          `https://sch.sooplive.com/api.php?l=DF&m=vodSearch&w=webk&isMobile=0&szType=json&c=UTF-8&v=5.0&szKeyword=${keyword}&nPageNo=${page}&nListCnt=${limit}&szOrder=reg_date&szSearchScope=title&szContentAttr=all&nIncludeTranslationMatch=0&szFileType=ALL&szTerm=${term}&tab=vod&location=total_search&isHashSearch=0`,
        );
        const text = await res.text();

        if (!res.ok) {
          return Response.json(text, { status: res.status });
        }

        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type':
              res.headers.get('Content-Type') ?? 'application/json',
            'Cache-Control':
              'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
          },
        });
      },
    },
  },
});
