import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_defaultLayout/musicbook/')({
  beforeLoad: () => {
    throw Route.redirect({ to: '/musicbook/9mogu9', replace: true });
  },
  component: () => null,
});
