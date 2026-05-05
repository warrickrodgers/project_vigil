import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared',
  'packages/clients',
  'packages/discord',
  'packages/agents',
]);
