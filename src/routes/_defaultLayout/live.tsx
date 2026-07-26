import { createFileRoute } from '@tanstack/react-router';
import { Button, Flex } from 'antd';
import { ExternalLink } from 'lucide-react';

import LiveCard from '@/components/LiveCard';
import { MEMBERS } from '@/data/constants';
import useLiveQuery from '@/hooks/query/useLiveQuery';

const RouteComponent = () => {
  const { data } = useLiveQuery();

  return (
    <>
      <Button
        className="mb-4"
        href={`https://soop-multi-view.netlify.app/${MEMBERS.map((member) => member.id).join('/')}`}
        rel="noreferrer"
        size="large"
        target="_blank"
        type="primary"
      >
        멀티뷰 열기 <ExternalLink size={16} />
      </Button>
      <Flex gap="small" wrap>
        {data.map((item, index) => (
          <LiveCard data={item} key={item.station?.stationNo ?? index} />
        ))}
      </Flex>
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/live')({
  staticData: { selectedKey: 'live' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
