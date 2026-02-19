import { createFileRoute } from '@tanstack/react-router';
import { Flex } from 'antd';

import LiveCard from '@/components/LiveCard';
import MultiViewButton from '@/components/MultiViewButton';
import useLiveQuery from '@/hooks/query/useLiveQuery';

const RouteComponent = () => {
  const { data } = useLiveQuery();

  return (
    <>
      <Flex gap="small" wrap>
        {data.map((item, index) => (
          <LiveCard data={item} key={item.station?.stationNo ?? index} />
        ))}
      </Flex>
      <MultiViewButton data={data} />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/live')({
  staticData: { selectedKey: 'live' },
  component: RouteComponent,
});
