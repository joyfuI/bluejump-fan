import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import type { DataType } from '@/components/MusicbookTable';
import MusicbookTable from '@/components/MusicbookTable';
import useCsvParse from '@/hooks/useCsvParse';

const RouteComponent = () => {
  const emailRef = useRef<HTMLAnchorElement>(null);

  const { data, meta, isLoading } = useCsvParse<DataType>(
    '/musicbook/yangdoki.csv',
  );

  useEffect(() => {
    if (emailRef.current) {
      emailRef.current.textContent = import.meta.env.VITE_CONTACT_EMAIL;
      emailRef.current.href = `mailto:${import.meta.env.VITE_CONTACT_EMAIL}`;
    }
  }, []);

  return (
    <>
      <p>
        아래 리스트는 수동으로 업데이트하고 있습니다. 최신 리스트는{' '}
        <a
          href="https://docs.google.com/spreadsheets/d/1eJ3KcCFJlqY3mUVtTl_U1B0O1Vp-d0vw4Lg10t5MAFY/edit?usp=sharing"
          rel="noreferrer"
          target="_blank"
        >
          원본 노래책
        </a>
        을 확인해 주세요.
      </p>
      <p>
        잘못된 목록 수정 등 문의는{' '}
        <a className="text-current" href=" " ref={emailRef}>
          #
        </a>
        으로 해주세요.
      </p>

      <MusicbookTable data={data ?? []} isLoading={isLoading} meta={meta} />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/musicbook/yangdoki')({
  staticData: { musicbook: 'yangdoki' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
