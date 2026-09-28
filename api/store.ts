import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Workspace } from '../shared/types';
import { HttpError } from './http-error';

export interface Store {
  readonly kind: 'memory' | 'dynamodb';
  get(id: string): Promise<Workspace | null>;
  put(ws: Workspace): Promise<void>;
  update(id: string, change: (ws: Workspace) => Workspace): Promise<Workspace>;
  countAiCall(date: string): Promise<number>;
}

const TTL_SECONDS = 30 * 86_400;
const expiresAt = () => Math.floor(Date.now() / 1000) + TTL_SECONDS;

export class MemoryStore implements Store {
  readonly kind = 'memory';
  private items = new Map<string, string>();
  private aiCalls = new Map<string, number>();

  async get(id: string) {
    const raw = this.items.get(id);
    return raw ? (JSON.parse(raw) as Workspace) : null;
  }

  async put(ws: Workspace) {
    this.items.set(ws.id, JSON.stringify(ws));
  }

  async update(id: string, change: (ws: Workspace) => Workspace) {
    const current = await this.get(id);
    if (!current) throw new HttpError(404, 'Workspace not found');
    const next = { ...change(current), version: current.version + 1 };
    await this.put(next);
    return next;
  }

  async countAiCall(date: string) {
    const count = (this.aiCalls.get(date) ?? 0) + 1;
    this.aiCalls.set(date, count);
    return count;
  }
}

export class DynamoStore implements Store {
  readonly kind = 'dynamodb';
  private doc: DynamoDBDocumentClient;

  constructor(
    private table: string,
    client = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async get(id: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.table, Key: { pk: `ws#${id}` }, ConsistentRead: true }));
    return res.Item ? (JSON.parse(res.Item.data as string) as Workspace) : null;
  }

  async put(ws: Workspace) {
    await this.doc.send(new PutCommand({ TableName: this.table, Item: this.toItem(ws) }));
  }

  async update(id: string, change: (ws: Workspace) => Workspace) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.get(id);
      if (!current) throw new HttpError(404, 'Workspace not found');
      const next = { ...change(current), version: current.version + 1 };
      try {
        await this.doc.send(
          new PutCommand({
            TableName: this.table,
            Item: this.toItem(next),
            ConditionExpression: 'version = :expected',
            ExpressionAttributeValues: { ':expected': current.version },
          }),
        );
        return next;
      } catch (err) {
        if (!(err instanceof ConditionalCheckFailedException)) throw err;
      }
    }
    throw new HttpError(409, 'This family was updated from another screen. Please try again.');
  }

  async countAiCall(date: string) {
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { pk: `ai#${date}` },
        UpdateExpression: 'ADD calls :one SET expiresAt = :ttl',
        ExpressionAttributeValues: { ':one': 1, ':ttl': expiresAt() },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(res.Attributes?.calls ?? 0);
  }

  private toItem(ws: Workspace) {
    return { pk: `ws#${ws.id}`, version: ws.version, data: JSON.stringify(ws), expiresAt: expiresAt() };
  }
}
