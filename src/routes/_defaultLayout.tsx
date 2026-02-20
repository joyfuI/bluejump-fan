import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Layout } from 'antd';

import Header from '@/components/Header';

const RouteComponent = () => {
  return (
    <Layout className="min-h-screen">
      <Header />
      <Layout.Content className="px-6 pt-6 pb-28">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
};

export const Route = createFileRoute('/_defaultLayout')({
  component: RouteComponent,
});
