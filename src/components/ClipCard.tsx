import { Badge, Card, Image } from 'antd';
import dayjs from 'dayjs';
import { useRef } from 'react';

import type { GetVodSearchResponse } from '@/api/getVodSearch';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';

export type ClipCardProps = { data: GetVodSearchResponse['DATA'][number] };

const ClipCard = ({ data }: ClipCardProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const isIntersecting = useIntersectionObserver(ref);

  const day = dayjs(data.reg_date);

  return (
    <div className="flex w-75 min-h-76" ref={ref}>
      {isIntersecting ? (
        <Card
          cover={
            <a
              className="relative overflow-hidden"
              href={data.url}
              rel="noreferrer"
              target="_blank"
            >
              <Image
                alt={data.title}
                className="block aspect-video"
                loading="lazy"
                preview={false}
                src={data.thumbnail_path}
                width={300}
              />
              <Badge
                count={data.duration}
                styles={{
                  root: { position: 'absolute', right: 4, bottom: 10 },
                }}
                title=""
              />
              {data.type === 'CATCH' ? (
                <img
                  alt="catch"
                  className="absolute top-2 left-2"
                  loading="lazy"
                  src="/images/catch.svg"
                  width={20}
                />
              ) : null}
            </a>
          }
          styles={{
            root: { display: 'flex', width: 300, flexDirection: 'column' },
            actions: { marginTop: 'auto' },
          }}
        >
          <Card.Meta
            description={
              <>
                <a
                  className="text-current"
                  href={`https://www.sooplive.com/station/${data.user_id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {data.user_nick}
                </a>{' '}
                |{' '}
                <a
                  className="text-current"
                  href={`https://www.sooplive.com/station/${data.original_bj}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {data.original_user_nick}
                </a>{' '}
                | <span title={day.format('LLL')}>{day.fromNow()}</span>
              </>
            }
            styles={{ title: { overflow: 'visible', whiteSpace: 'normal' } }}
            title={
              <a
                className="text-current"
                href={data.url}
                rel="noreferrer"
                target="_blank"
              >
                {data.title}
              </a>
            }
          />
        </Card>
      ) : null}
    </div>
  );
};

export default ClipCard;
