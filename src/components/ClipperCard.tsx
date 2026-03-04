import { Avatar, Card, Typography } from 'antd';
import dayjs from 'dayjs';

import type { YoutubeChannelCard } from '@/helpers/youtube.server';

export type ClipperCardProps = { data: YoutubeChannelCard };

const ClipperCard = ({ data }: ClipperCardProps) => {
  return (
    <a
      className="flex w-90 text-current"
      href={`https://www.youtube.com/channel/${data.id}`}
      rel="noreferrer"
      target="_blank"
    >
      <Card
        actions={[
          <Typography.Text key="videoPublishedAt">
            동영상
            <br />
            {data.videoCount}개
          </Typography.Text>,
          <Typography.Text key="videoPublishedAt">
            구독자
            <br />
            {data.subscriberCount}명
          </Typography.Text>,
          <Typography.Text key="videoPublishedAt">
            마지막 업로드
            <br />
            {dayjs(data.videoPublishedAt).fromNow()}
          </Typography.Text>,
        ]}
        hoverable
        styles={{
          root: { display: 'flex', width: '100%', flexDirection: 'column' },
          actions: { marginTop: 'auto' },
        }}
      >
        <Card.Meta
          avatar={<Avatar src={data.thumbnail} />}
          description={data.description}
          title={data.title}
        />
      </Card>
    </a>
  );
};

export default ClipperCard;
