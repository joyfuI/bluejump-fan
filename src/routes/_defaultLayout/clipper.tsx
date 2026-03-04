import { createFileRoute } from '@tanstack/react-router';
import { Alert, Flex } from 'antd';
import { useEffect, useRef } from 'react';

import Accordion from '@/components/Accordion.tsx';
import ClipperCard from '@/components/ClipperCard.tsx';
import FilterButton from '@/components/FilterButton.tsx';
import useClipperQuery from '@/hooks/query/useClipperQuery.ts';

const RouteComponent = () => {
  const emailRef = useRef<HTMLAnchorElement>(null);

  const { data } = useClipperQuery();

  useEffect(() => {
    if (emailRef.current) {
      emailRef.current.textContent = import.meta.env.VITE_CONTACT_EMAIL;
      emailRef.current.href = `mailto:${import.meta.env.VITE_CONTACT_EMAIL}`;
    }
  }, []);

  return (
    <>
      <Alert
        className="mb-6"
        title={
          <>
            <a
              href="https://cafe.naver.com/bluejumpofficial/1769"
              rel="noreferrer"
              target="_blank"
            >
              블루점프 2차 창작 가이드라인
            </a>
            <Accordion className="ml-2" label="등재 조건 및 추가/삭제 요청">
              <ul className="list-disc pl-5">
                <li>블루점프만 다룰 것(+스콘까진 ok)</li>
                <li>최근 6개월 내에 업로드한 영상이 있을 것</li>
              </ul>
              <p>
                키리누키 추가 및 삭제 등 문의는{' '}
                <a className="text-current" href=" " ref={emailRef}>
                  #
                </a>
                으로 해주세요.
              </p>
            </Accordion>
          </>
        }
        type="warning"
      />
      <Flex gap="small" wrap>
        {data?.map((item) => (
          <ClipperCard data={item} key={item.id} />
        ))}
      </Flex>
      <FilterButton />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/clipper')({
  component: RouteComponent,
});
