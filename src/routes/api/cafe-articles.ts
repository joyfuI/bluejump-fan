import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/cafe-articles')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const cafeId = requestUrl.searchParams.get('cafeId');
        const menuId = requestUrl.searchParams.get('menuId');
        const page = requestUrl.searchParams.get('page');
        const pageSize = requestUrl.searchParams.get('pageSize');

        const res = await fetch(
          `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${cafeId}/menus/${menuId}/articles?page=${page}&pageSize=${pageSize}&sortBy=TIME&viewType=C`,
        );
        const text = await res.text();

        if (!res.ok) {
          return Response.json(text, { status: res.status });
        }

        return new Response(text, {
          status: 200,
          headers: {
            'content-type':
              res.headers.get('content-type') ?? 'application/json',
            'cache-control': 'public, s-maxage=60, stale-while-revalidate=600',
          },
        });
      },
    },
  },
});
