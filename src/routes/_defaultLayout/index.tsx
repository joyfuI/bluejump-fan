import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_defaultLayout/')({
  beforeLoad: () => {
    throw Route.redirect({ to: '/live', replace: true });
  },
  component: () => null,
});
