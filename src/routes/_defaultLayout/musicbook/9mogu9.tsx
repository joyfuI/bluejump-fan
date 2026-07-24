import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

const RouteComponent = () => {
  const emailRef = useRef<HTMLAnchorElement>(null);

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
          href="https://mogugu-song.netlify.app/"
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
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/musicbook/9mogu9')({
  staticData: { musicbook: '9mogu9' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
