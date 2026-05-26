import type { IconUpload } from "./types";

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: Record<string, string>;
  httpMetadata: Record<string, string>;
  customMetadata: Record<string, string>;
  range?: { offset: number; length: number };
  uploaded: Date;
  version: string;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  json<T>(): Promise<T>;
}

// In-memory mock for local dev
class MockBucket implements R2Bucket {
  private store = new Map<string, { data: Uint8Array; meta: any }>();

  async put(key: string, value: string | ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<R2Object> {
    let data: Uint8Array;
    if (typeof value === "string") {
      data = new TextEncoder().encode(value);
    } else if (value instanceof ArrayBuffer) {
      data = new Uint8Array(value);
    } else {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
      }
      const total = chunks.reduce((a, b) => a + b.length, 0);
      data = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    }
    this.store.set(key, { data, meta: options });
    return {
      key,
      size: data.length,
      etag: "mock",
      httpEtag: '"mock"',
      checksums: {},
      httpMetadata: options?.httpMetadata ?? {},
      customMetadata: options?.customMetadata ?? {},
      uploaded: new Date(),
      version: "1",
    };
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    return {
      key,
      size: entry.data.length,
      etag: "mock",
      httpEtag: '"mock"',
      checksums: {},
      httpMetadata: entry.meta?.httpMetadata ?? {},
      customMetadata: entry.meta?.customMetadata ?? {},
      uploaded: new Date(),
      version: "1",
      bodyUsed: false,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(entry.data);
          controller.close();
        },
      }),
      async arrayBuffer() {
        return entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer;
      },
      async text() {
        return new TextDecoder().decode(entry.data);
      },
      async blob() {
        return new Blob([entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer]);
      },
      async json<T>() {
        return JSON.parse(new TextDecoder().decode(entry.data));
      },
    };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

let mockBucket: MockBucket | null = null;

export function getBucket(platform: any): R2Bucket {
  if (platform?.env?.BUCKET) {
    return platform.env.BUCKET as R2Bucket;
  }
  if (!mockBucket) {
    mockBucket = new MockBucket();
  }
  return mockBucket;
}

export async function uploadSVG(platform: any, projectId: number, iconName: string, content: string): Promise<string> {
  const bucket = getBucket(platform);
  const key = `projects/${projectId}/${iconName}.svg`;
  await bucket.put(key, content, {
    httpMetadata: { contentType: "image/svg+xml" },
    customMetadata: { projectId: String(projectId), name: iconName },
  });
  return key;
}

export async function getSVG(platform: any, key: string): Promise<string | null> {
  const bucket = getBucket(platform);
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj.text();
}

export async function deleteSVG(platform: any, key: string): Promise<void> {
  const bucket = getBucket(platform);
  await bucket.delete(key);
}
