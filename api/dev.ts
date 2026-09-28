import { serve } from '@hono/node-server';
import { aiEnabled } from './claude';
import { createApp } from './app';
import { DynamoStore, MemoryStore } from './store';

const port = Number(process.env.PORT || 8787);
const table = process.env.TABLE_NAME;
const store = table ? new DynamoStore(table) : new MemoryStore();

serve({ fetch: createApp(store).fetch, port }, (info) => {
  const ai = aiEnabled() ? 'Claude on Amazon Bedrock' : 'rules engine only (set AI_PROVIDER=bedrock for Claude)';
  console.log(`Anchor API on http://localhost:${info.port}/api  store: ${store.kind}  AI: ${ai}`);
});
