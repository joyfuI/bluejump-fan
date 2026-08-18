import { createFileRoute } from '@tanstack/react-router';
import { Alert, Flex } from 'antd';
import { useEffect, useRef } from 'react';

import ClipCard from '@/components/ClipCard';
import useClipQuery from '@/hooks/query/useClipQuery';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';

const RouteComponent = () => {
  const ref = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useClipQuery(
    '로니',
    [
      '페퍼로니',
      '콜로니',
      '트로니카',
      '크로니클',
      '베로니카',
      /[(/-]\s*마로니에/g,
      /마로니에\s*[)/-]/g,
      '로니세라',
    ],
    ['marronie'],
  );

  const isIntersecting = useIntersectionObserver(ref);

  useEffect(() => {
    if (hasNextPage && isIntersecting && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isIntersecting, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <Alert
        className="mb-6"
        title="최근 1개월까지만 검색합니다. 본인 방송국 클립은 제외합니다."
        type="info"
      />
      <Flex gap="small" wrap>
        {data?.flat().map((item) => (
          <ClipCard data={item} key={item.title_no} />
        ))}
        <div className={hasNextPage ? 'w-75 min-h-76' : 'hidden'} ref={ref} />
      </Flex>
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/clip/marronie')({
  staticData: { clip: 'marronie' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
