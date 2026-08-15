import { createFileRoute } from '@tanstack/react-router';
import { Alert, Flex } from 'antd';
import { useEffect, useRef } from 'react';

import ClipCard from '@/components/ClipCard';
import useClipQuery from '@/hooks/query/useClipQuery';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';

const RouteComponent = () => {
  const ref = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useClipQuery(
    '도끼',
    ['도끼병', '도끼던지'],
    ['yangdoki'],
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

export const Route = createFileRoute('/_defaultLayout/clip/yangdoki')({
  staticData: { clip: 'yangdoki' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
