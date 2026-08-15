import {
  createFileRoute,
  Link,
  Outlet,
  useMatches,
} from '@tanstack/react-router';
import { Menu } from 'antd';

import { MEMBERS } from '@/data/constants';

const items = [
  { key: 'bluejump', label: <Link to="/clip/bluejump">블루점프</Link> },
  ...MEMBERS.map((member) => ({
    key: member.id,
    label: <Link to={`/clip/${member.id}`}>{member.nick}</Link>,
  })),
];

const RouteComponent = () => {
  const musicbook = useMatches({
    select: (matches) =>
      matches.findLast((m) => m.staticData?.clip)?.staticData.clip,
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

export const Route = createFileRoute('/_defaultLayout/clip')({
  staticData: { selectedKey: 'clip' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
