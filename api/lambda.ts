import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { DynamoStore, MemoryStore } from './store';

const table = process.env.TABLE_NAME;

export const handler = handle(createApp(table ? new DynamoStore(table) : new MemoryStore()));
