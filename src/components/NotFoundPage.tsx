import { Layout, Result } from 'antd';

import Header from '@/components/Header';

const NotFoundPage = () => {
  return (
    <Layout className="min-h-screen">
      <Header />
      <Layout.Content className="px-6 pt-6 pb-28">
        <Result
          status="404"
          subTitle="요청하신 페이지를 찾을 수 없습니다."
          title="404 오류"
        />
      </Layout.Content>
    </Layout>
  );
};

export default NotFoundPage;
