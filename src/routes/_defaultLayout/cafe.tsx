import { createFileRoute } from '@tanstack/react-router';
import { Alert, Image, List } from 'antd';
import dayjs from 'dayjs';

import useCafeQuery from '@/hooks/query/useCafeQuery';

const RouteComponent = () => {
  const { data } = useCafeQuery();

  return (
    <>
      <Alert
        className="max-w-7xl mx-auto mb-6"
        title="카페 게시판 별로 첫 번째 페이지만 불러옵니다."
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
              description={`${item.item.writerInfo.nickName} / ${dayjs(item.item.writeDateTimestamp).format('LLL')}`}
              title={
                <a
                  href={`https://cafe.naver.com/ArticleRead.nhn?clubid=${item.item.cafeId}&articleid=${item.item.articleId}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.item.subject}
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
