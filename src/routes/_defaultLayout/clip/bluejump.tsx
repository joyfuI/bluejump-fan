import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Alert, Flex } from 'antd';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { GetVodSearchResponse } from '@/api/getVodSearch';
import ClipCard from '@/components/ClipCard';
import useClipQuery from '@/hooks/query/useClipQuery';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';

const PAGE_SIZE = 20;

const getFrontier = (
  data: InfiniteData<GetVodSearchResponse, number> | undefined,
  hasNextPage: boolean | undefined,
) =>
  hasNextPage === false
    ? Number.NEGATIVE_INFINITY
    : (data?.pages.at(-1)?.DATA.at(-1)?.timestamp ?? Number.POSITIVE_INFINITY);

const RouteComponent = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const queryClient = useQueryClient();
  const queryCache = queryClient.getQueryCache();
  const subscribe = useCallback(
    (onStoreChange: () => void) => queryCache.subscribe(onStoreChange),
    [queryCache],
  );
  const getRawData1 = useCallback(
    () =>
      queryClient.getQueryData<InfiniteData<GetVodSearchResponse, number>>([
        'getVodSearch',
        '블루점프',
      ]),
    [queryClient],
  );
  const getRawData2 = useCallback(
    () =>
      queryClient.getQueryData<InfiniteData<GetVodSearchResponse, number>>([
        'getVodSearch',
        '블점',
      ]),
    [queryClient],
  );

  const {
    data: data1,
    fetchNextPage: fetchNextPage1,
    hasNextPage: hasNextPage1,
    isFetchNextPageError: isFetchNextPageError1,
    isFetchingNextPage: isFetchingNextPage1,
  } = useClipQuery('블루점프', []);
  const {
    data: data2,
    fetchNextPage: fetchNextPage2,
    hasNextPage: hasNextPage2,
    isFetchNextPageError: isFetchNextPageError2,
    isFetchingNextPage: isFetchingNextPage2,
  } = useClipQuery('블점', ['더블점프']);

  const rawData1 = useSyncExternalStore(subscribe, getRawData1, getRawData1);
  const rawData2 = useSyncExternalStore(subscribe, getRawData2, getRawData2);
  const frontier1 = getFrontier(rawData1, hasNextPage1);
  const frontier2 = getFrontier(rawData2, hasNextPage2);
  const cutoff = Math.max(frontier1, frontier2);

  const safeData = useMemo(() => {
    const itemsByTitleNo = new Map(
      [...(data1?.flat() ?? []), ...(data2?.flat() ?? [])].map(
        (item) => [item.title_no, item] as const,
      ),
    );

    return [...itemsByTitleNo.values()]
      .toSorted(
        (a, b) =>
          b.timestamp - a.timestamp || b.title_no.localeCompare(a.title_no),
      )
      .filter((item) => item.timestamp >= cutoff);
  }, [cutoff, data1, data2]);
  const data = safeData.slice(0, visibleCount);
  const hasNextPage = Boolean(
    safeData.length > visibleCount || hasNextPage1 || hasNextPage2,
  );
  const isFetchNextPageError = isFetchNextPageError1 || isFetchNextPageError2;
  const isFetchingNextPage = isFetchingNextPage1 || isFetchingNextPage2;
  const needsShortKeywordCoverage = Boolean(
    hasNextPage2 && frontier2 > frontier1,
  );
  const queriesReady = rawData1 !== undefined && rawData2 !== undefined;

  const isIntersecting = useIntersectionObserver(ref);

  useEffect(() => {
    if (!hasNextPage || !isIntersecting || safeData.length < visibleCount) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const rect = ref.current?.getBoundingClientRect();

      if (
        rect &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
      ) {
        setVisibleCount((count) => count + PAGE_SIZE);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [hasNextPage, isIntersecting, safeData.length, visibleCount]);

  useEffect(() => {
    if (
      !isIntersecting ||
      safeData.length >= visibleCount ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      !queriesReady
    ) {
      return;
    }

    // 더 최근 시간대에 머물러 있는 검색을 먼저 소진해 출력 순서를 고정한다.
    if (needsShortKeywordCoverage) {
      void fetchNextPage2();
    } else if (hasNextPage1) {
      void fetchNextPage1();
    } else if (hasNextPage2) {
      void fetchNextPage2();
    }
  }, [
    fetchNextPage1,
    fetchNextPage2,
    hasNextPage1,
    hasNextPage2,
    isFetchNextPageError,
    isFetchingNextPage,
    isIntersecting,
    needsShortKeywordCoverage,
    queriesReady,
    safeData.length,
    visibleCount,
  ]);

  return (
    <>
      <Alert
        className="mb-6"
        title="최근 1개월까지만 검색합니다."
        type="info"
      />
      <Flex gap="small" wrap>
        {data.map((item) => (
          <ClipCard data={item} key={item.title_no} />
        ))}
        <div className={hasNextPage ? 'w-75 min-h-76' : 'hidden'} ref={ref} />
      </Flex>
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/clip/bluejump')({
  staticData: { clip: 'bluejump' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
