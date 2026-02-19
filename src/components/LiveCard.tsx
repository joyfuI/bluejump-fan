import { Avatar, Card, Empty, Image, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import type { GetHomeBroadResponse } from '@/api/getHomeBroad';
import type { GetStationInfoResponse } from '@/api/getStationInfo';
import useInterval from '@/hooks/useInterval';

export type LiveCardProps = {
  data: Partial<GetStationInfoResponse> & {
    broad: GetHomeBroadResponse | null;
  };
};

const LiveCard = ({ data }: LiveCardProps) => {
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    setImageSrc(`https://liveimg.sooplive.co.kr/h/${data.broad?.broadNo}.webp`);
  }, [data.broad?.broadNo]);

  useInterval(() => {
    setImageSrc(
      `https://liveimg.sooplive.co.kr/h/${data.broad?.broadNo}.webp?t=${Date.now()}`,
    );
  }, 10000);

  return (
    <Card
      cover={
        data.station?.userId && data.broad?.broadTitle && imageSrc ? (
          <a
            className="overflow-hidden"
            href={`https://play.sooplive.co.kr/${data.station.userId}`}
            rel="noreferrer"
            target="_blank"
          >
            <Image
              alt={data.broad.broadTitle}
              className="block aspect-video"
              loading="lazy"
              preview={false}
              src={imageSrc}
              width={300}
            />
          </a>
        ) : (
          <Empty
            className="m-0 content-center aspect-video"
            description={false}
          />
        )
      }
      styles={{
        root: { display: 'flex', width: 300, flexDirection: 'column' },
        actions: { marginTop: 'auto' },
      }}
    >
      <Card.Meta
        avatar={
          <a
            className="text-current"
            href={`https://www.sooplive.co.kr/station/${data.station?.userId ?? ''}`}
            rel="noreferrer"
            target="_blank"
          >
            <Avatar src={data.station?.profileImage} />
          </a>
        }
        description={
          data.station?.userId && data.broad?.broadTitle ? (
            <a
              className="text-current"
              href={`https://play.sooplive.co.kr/${data.station.userId}`}
              rel="noreferrer"
              target="_blank"
            >
              {data.broad.broadTitle}
            </a>
          ) : (
            '방송 중이 아닙니다.'
          )
        }
        title={
          <a
            className="text-current"
            href={`https://www.sooplive.co.kr/station/${data.station?.userId ?? ''}`}
            rel="noreferrer"
            target="_blank"
          >
            {data.station?.userNick}
          </a>
        }
      />
      {data.broad?.broadStart ? (
        <Typography.Text className="block mt-3 text-right" type="warning">
          방송시작: {dayjs(data.broad.broadStart).format('L LTS')}
        </Typography.Text>
      ) : null}
    </Card>
  );
};

export default LiveCard;
