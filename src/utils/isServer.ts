import { createIsomorphicFn } from '@tanstack/react-start';

const isServer = createIsomorphicFn()
  .server(() => true)
  .client(() => false);

export default isServer;
