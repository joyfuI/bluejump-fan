import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_defaultLayout/clip/')({
  beforeLoad: () => {
    throw Route.redirect({ to: '/clip/bluejump', replace: true });
  },
  component: () => null,
});
