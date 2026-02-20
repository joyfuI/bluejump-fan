import { createFileRoute } from '@tanstack/react-router';
import { Alert, Image, List } from 'antd';
import dayjs from 'dayjs';

import Accordion from '@/components/Accordion.tsx';
import { MEMBERS } from '@/data/constants.ts';
import useCafeQuery from '@/hooks/query/useCafeQuery';

const RouteComponent = () => {
  const { data } = useCafeQuery();

  return (
    <>
      <Alert
        className="max-w-7xl mx-auto mb-6"
        title={
          <>
            카페 게시판 별로 첫 번째 페이지만 불러옵니다.
            <Accordion className="ml-2" label="카페 게시판 목록">
              <ul className="list-disc pl-5">
                {MEMBERS.values()
                  .filter((member) => member.cafe)
                  .map((member) => (
                    <li key={member.id}>
                      <a
                        className="text-current"
                        href={member.cafe?.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {member.cafe?.name}
                      </a>
                      :{' '}
                      {member.cafe?.menus?.map((menu) => menu.name).join(', ')}
                    </li>
                  ))
                  .toArray()}
              </ul>
            </Accordion>
          </>
        }
        type="info"
      />
      <List
        className="max-w-7xl my-0 mx-auto"
        dataSource={data}
        itemLayout="vertical"
        renderItem={(item) => (
          <List.Item
            extra={
              item.item.representImage ? (
                <Image
                  alt={item.item.subject}
                  className="object-cover"
                  height={144}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={item.item.representImage}
                  width={144}
                />
              ) : (
                <div className="w-36 h-36" />
              )
            }
            key={item.item.articleId}
          >
            <List.Item.Meta
              description={[
                item.item.menuName,
                dayjs(item.item.writeDateTimestamp).format('LLL'),
              ]
                .filter(Boolean)
                .join(' / ')}
              title={
                <a
                  href={`https://cafe.naver.com/ArticleRead.nhn?clubid=${item.item.cafeId}&articleid=${item.item.articleId}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  [{item.item.writerInfo.nickName}] {item.item.subject}
                </a>
              }
            />
            {item.item.summary}
          </List.Item>
        )}
        size="large"
      />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/cafe')({
  staticData: { selectedKey: 'cafe' },
  component: RouteComponent,
});
