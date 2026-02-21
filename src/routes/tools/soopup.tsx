import { createFileRoute } from '@tanstack/react-router';

const RouteComponent = () => {
  return <div>Hello "/tools/soopup"!</div>;
};

export const Route = createFileRoute('/tools/soopup')({
  component: RouteComponent,
});
