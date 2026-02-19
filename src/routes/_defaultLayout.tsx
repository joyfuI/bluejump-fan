import {
  createFileRoute,
  Link,
  Outlet,
  useMatches,
} from '@tanstack/react-router';
import { Layout, Menu, Typography } from 'antd';
import { ExternalLink } from 'lucide-react';

const items = [
  { key: 'live', label: <Link to="/live">라이브 모아보기</Link> },
  { key: 'calendar', label: <Link to="/calendar">캘린더 모아보기</Link> },
  { key: 'soop', label: <Link to="/soop">방송국글 모아보기</Link> },
  { key: 'cafe', label: <Link to="/cafe">카페글 모아보기</Link> },
  { key: 'review', label: <Link to="/review">다시보기 모아보기</Link> },
  {
    key: 'bluejump',
    label: (
      <a
        href="https://cafe.naver.com/bluejumpofficial"
        rel="noreferrer"
        target="_blank"
      >
        블루점프 팬카페
        <ExternalLink className="inline ml-1" size={16} />
      </a>
    ),
  },
];

const RouteComponent = () => {
  const matches = useMatches();
  const selectedKeys = matches
    .values()
    .filter((m) => m.staticData?.selectedKey)
    .map((m) => m.staticData.selectedKey)
    .toArray() as string[];

  return (
    <Layout className="min-h-screen">
      <Layout.Header className="flex items-center gap-12">
        <Link to="/">
          <Typography.Title className="m-0 text-white" level={4}>
            블루점프 팬사이트
          </Typography.Title>
        </Link>
        <Menu
          className="flex-1 min-w-0"
          items={items}
          mode="horizontal"
          selectedKeys={selectedKeys}
          theme="dark"
        />
      </Layout.Header>
      <Layout.Content className="px-6 pt-6 pb-28">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
};

export const Route = createFileRoute('/_defaultLayout')({
  component: RouteComponent,
});
