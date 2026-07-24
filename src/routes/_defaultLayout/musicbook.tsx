import {
  createFileRoute,
  Link,
  Outlet,
  useMatches,
} from '@tanstack/react-router';
import { Menu } from 'antd';

const items = [
  { key: '9mogu9', label: <Link to="/musicbook/9mogu9">모구구 노래책</Link> },
  { key: 'haroha', label: <Link to="/musicbook/haroha">하로하 노래책</Link> },
  {
    key: 'marronie',
    label: <Link to="/musicbook/marronie">마로니 노래책</Link>,
  },
  {
    key: 'yangdoki',
    label: <Link to="/musicbook/yangdoki">양도끼 노래책</Link>,
  },
  { key: 'overlap', label: <Link to="/musicbook/overlap">겹치는 노래</Link> },
];

const RouteComponent = () => {
  const musicbook = useMatches({
    select: (matches) =>
      matches.findLast((m) => m.staticData?.musicbook)?.staticData.musicbook,
  });

  return (
    <>
      <Menu
        className="mb-4"
        items={items}
        mode="horizontal"
        selectedKeys={musicbook ? [musicbook] : []}
      />

      <Outlet />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/musicbook')({
  staticData: { selectedKey: 'musicbook' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
