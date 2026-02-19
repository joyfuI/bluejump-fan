import { createFileRoute } from '@tanstack/react-router';
import { Alert, Flex } from 'antd';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';

import FilterButton from '@/components/FilterButton';
import VodCard from '@/components/VodCard';
import { MEMBERS } from '@/data/constants';
import useReviewQuery from '@/hooks/query/useReviewQuery';

const RouteComponent = () => {
  const [userId] = useQueryState(
    'userId',
    parseAsArrayOf(parseAsString).withDefault(
      MEMBERS.map((member) => member.id),
    ),
  );

  const { data } = useReviewQuery();

  return (
    <>
      <Alert
        className="mb-6"
        title="방송국 별로 첫 번째 페이지만 불러옵니다."
        type="info"
      />
      <Flex gap="small" wrap>
        {data
          .values()
          .filter((item) => userId.includes(item.user_id))
          .map((item) => <VodCard data={item} key={item.title_no} />)
          .toArray()}
      </Flex>
      <FilterButton />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/review')({
  staticData: { selectedKey: 'review' },
  component: RouteComponent,
});
