import { createFileRoute } from '@tanstack/react-router';
import { Alert, Image, List } from 'antd';
import dayjs from 'dayjs';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';

import FilterButton from '@/components/FilterButton';
import { MEMBERS } from '@/data/constants';
import useSoopQuery from '@/hooks/query/useSoopQuery';

const RouteComponent = () => {
  const [userId] = useQueryState(
    'userId',
    parseAsArrayOf(parseAsString).withDefault(
      MEMBERS.map((member) => member.id),
    ),
  );

  const { data } = useSoopQuery({ onlyMember: true });

  return (
    <>
      <Alert
        className="max-w-7xl mx-auto mb-6"
        title="방송국 별로 첫 번째 페이지만 불러옵니다."
        type="info"
      />
      <List
        className="max-w-7xl my-0 mx-auto"
        dataSource={data.filter((item) => userId.includes(item.user_id))}
        itemLayout="vertical"
        renderItem={(item) => (
          <List.Item
            extra={
              item.photos?.length || item.ucc?.thumb ? (
                <Image
                  alt={item.title_name}
                  className="object-cover"
                  height={144}
                  loading="lazy"
                  src={
                    item.board_type === 105 && item.ucc
                      ? item.ucc.thumb
                      : item.photos[0].url
                  }
                  width={144}
                />
              ) : (
                <div className="w-36 h-36" />
              )
            }
            key={item.title_no}
          >
            <List.Item.Meta
              description={`${item.user_nick} / ${item.display.bbs_name} / ${dayjs(item.reg_date, 'YYYY-MM-DD HH:mm:ss').format('LLL')}`}
              title={
                <a
                  href={
                    item.board_type === 105
                      ? `https://vod.sooplive.co.kr/player/${item.title_no}`
                      : `https://www.sooplive.co.kr/station/${item.user_id}/post/${item.title_no}`
                  }
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.title_name}
                </a>
              }
            />
            {item.content.summary}
          </List.Item>
        )}
        size="large"
      />
      <FilterButton />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/soop')({
  staticData: { selectedKey: 'soop' },
  component: RouteComponent,
});
