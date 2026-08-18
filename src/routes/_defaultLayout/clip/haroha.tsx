import { createFileRoute } from '@tanstack/react-router';
import { Alert, Flex } from 'antd';
import { useEffect, useRef } from 'react';

import ClipCard from '@/components/ClipCard';
import useClipQuery from '@/hooks/query/useClipQuery';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';

const RouteComponent = () => {
  const ref = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useClipQuery(
    '로하',
    [
      '아로하',
      '알로하',
      /폭로하[가-힣]/g,
      /발로하[가-힣]/g,
      /토로하[가-힣]/g,
      /위로하[가-힣]/g,
      /말로하[가-힣]/g,
      /새로하[가-힣]/g,
      /바로하[가-힣]/g,
      /[대목]표로하[가-힣]/g,
      /[가-힣]으로하[가-힣]/g,
      /[가-힣]대로하[가-힣]/g,
      /함부로하[가-힣]/g,
      /거꾸로하[가-힣]/g,
      '뭐로하지',
      /솔로하[가-힣]/g,
      '페로하이',
      '이로하',
    ],
    ['haroha'],
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

export const Route = createFileRoute('/_defaultLayout/clip/haroha')({
  staticData: { clip: 'haroha' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
