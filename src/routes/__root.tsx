import { StyleProvider } from '@ant-design/cssinjs';
import { TanStackDevtools } from '@tanstack/react-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { ConfigProvider } from 'antd';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import type { ReactNode } from 'react';

import appCss from '@/styles.css?url';
import '@/lib/dayjs';

type RouterContext = { queryClient: QueryClient };

const RootDocument = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        <StyleProvider layer>
          <ConfigProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </ConfigProvider>
        </StyleProvider>
        <TanStackDevtools
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            { name: 'Tanstack Query', render: <ReactQueryDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '블루점프 팬사이트' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.json' },
      {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),

  shellComponent: RootDocument,
});
