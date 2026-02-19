import { Avatar, Badge, Card, Image, Typography } from 'antd';
import dayjs from 'dayjs';

import type { GetVodsReviewResponse } from '@/api/getVodsReview';
import durationHumanize from '@/utils/durationHumanize';

export type VodCardProps = { data: GetVodsReviewResponse['data'][0] };

const VodCard = ({ data }: VodCardProps) => {
  return (
    <Card
      cover={
        <a
          className="relative overflow-hidden"
          href={`https://vod.sooplive.co.kr/player/${data.title_no}`}
          rel="noreferrer"
          target="_blank"
        >
          <Image
            alt={data.title_name}
            className="block w-full h-auto"
            loading="lazy"
            preview={false}
            src={`https:${data.ucc.thumb}`}
          />
          <Badge
            count={durationHumanize(data.ucc.total_file_duration)}
            styles={{ root: { position: 'absolute', right: 4, bottom: 10 } }}
            title=""
          />
        </a>
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
            href={`https://www.sooplive.co.kr/station/${data.user_id}`}
            rel="noreferrer"
            target="_blank"
          >
            <Avatar src={data.profile_image} />
          </a>
        }
        description={
          <a
            className="text-current"
            href={`https://www.sooplive.co.kr/station/${data.user_id}`}
            rel="noreferrer"
            target="_blank"
          >
            {data.user_nick}
          </a>
        }
        title={
          <a
            className="text-current"
            href={`https://vod.sooplive.co.kr/player/${data.title_no}`}
            rel="noreferrer"
            target="_blank"
            title={data.title_name}
          >
            {data.title_name}
          </a>
        }
      />
      <Typography.Text className="block mt-3 text-right" type="warning">
        {dayjs(data.reg_date).format('L LTS')}
      </Typography.Text>
    </Card>
  );
};

export default VodCard;
