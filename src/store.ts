import { SCHEMA_SQL } from "./schema.js";

export type SqlValue = string | number | null;

export type Statement = {
  run(...args: SqlValue[]): Promise<{ changes: number }>;
  get<T = Record<string, unknown>>(...args: SqlValue[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...args: SqlValue[]): Promise<T[]>;
};

export type Database = {
  exec(sql: string): Promise<void>;
  prepare(sql: string): Statement;
  batch(ops: { sql: string; args: SqlValue[] }[]): Promise<void>;
  close(): void;
};

export type BlobStore = {
  put(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
};

export async function applySchema(db: Database): Promise<void> {
  const statements = SCHEMA_SQL.split(";")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);
  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}

export class MemoryBlobs implements BlobStore {
  readonly map = new Map<string, Uint8Array>();

  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.map.set(key, Uint8Array.from(bytes));
  }

  async get(key: string): Promise<Uint8Array | null> {
    const value = this.map.get(key);
    return value ? Uint8Array.from(value) : null;
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((key) => key.startsWith(prefix)).sort();
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async deletePrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        n += 1;
      }
    }
    return n;
  }
}

type D1Like = {
  exec(query: string): Promise<unknown>;
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
};

export function wrapD1(d1: D1Like): Database {
  return {
    async exec(sql: string) {
      await d1.exec(sql);
    },
    prepare(sql: string): Statement {
      return {
        async run(...args: SqlValue[]) {
          const result = await d1.prepare(sql).bind(...args).run();
          return { changes: Number(result.meta?.changes ?? 0) };
        },
        async get<T = Record<string, unknown>>(...args: SqlValue[]) {
          const row = await d1.prepare(sql).bind(...args).first<T>();
          return row ?? undefined;
        },
        async all<T = Record<string, unknown>>(...args: SqlValue[]) {
          const result = await d1.prepare(sql).bind(...args).all<T>();
          return result.results;
        },
      };
    },
    async batch(ops) {
      await d1.batch(ops.map((op) => d1.prepare(op.sql).bind(...op.args)));
    },
    close() {},
  };
}

type R2Like = {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<unknown>;
};

export function wrapR2(bucket: R2Like): BlobStore {
  return {
    async put(key, bytes, contentType) {
      await bucket.put(key, bytes, contentType ? { httpMetadata: { contentType } } : undefined);
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return new Uint8Array(await obj.arrayBuffer());
    },
    async list(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, cursor });
        for (const obj of page.objects) keys.push(obj.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async deletePrefix(prefix) {
      const keys = await this.list(prefix);
      if (keys.length) await bucket.delete(keys);
      return keys.length;
    },
  };
}
