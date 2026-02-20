import { createFileRoute } from '@tanstack/react-router';
import type { SwitchProps } from 'antd';
import { Alert, Image, List, Switch } from 'antd';
import dayjs from 'dayjs';
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryState,
} from 'nuqs';

import FilterButton from '@/components/FilterButton';
import { MEMBERS } from '@/data/constants';
import useSoopQuery from '@/hooks/query/useSoopQuery';

const stationNoMap = MEMBERS.reduce<Record<number, (typeof MEMBERS)[0]>>(
  (acc, member) => {
    acc[member.stationNo] = member;
    return acc;
  },
  {},
);

const RouteComponent = () => {
  const [userId] = useQueryState(
    'userId',
    parseAsArrayOf(parseAsString).withDefault(
      MEMBERS.map((member) => member.id),
    ),
  );
  const [onlyMember, setOnlyMember] = useQueryState(
    'onlyMember',
    parseAsBoolean.withDefault(true),
  );

  const { data } = useSoopQuery({ onlyMember });

  const handleChange: SwitchProps['onChange'] = (checked) => {
    setOnlyMember(checked);
  };

  return (
    <>
      <Alert
        className="max-w-7xl mx-auto mb-6"
        title="방송국 별로 첫 번째 페이지만 불러옵니다."
        type="info"
      />
      <List
        className="max-w-7xl my-0 mx-auto"
        dataSource={data.filter((item) =>
          userId.includes(stationNoMap[item.station_no].id),
        )}
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
                  [{stationNoMap[item.station_no].nick}] {item.title_name}
                </a>
              }
            />
            {item.content.summary}
          </List.Item>
        )}
        size="large"
      />
      <FilterButton>
        <Switch
          checked={onlyMember}
          checkedChildren="스트리머 글만 보기"
          className="self-start"
          onChange={handleChange}
          unCheckedChildren="모든 글 보기"
        />
      </FilterButton>
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/soop')({
  staticData: { selectedKey: 'soop' },
  component: RouteComponent,
});
