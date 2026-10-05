process.env.NODE_ENV = 'test';

import { Server } from 'node:http';
import { app } from '../src/index.js';
import { repository } from '../src/lib/repository.js';

let server: Server | null = null;
let baseUrl = '';

export async function getTestServer(): Promise<{ baseUrl: string }> {
  if (server && baseUrl) {
    return { baseUrl };
  }

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  return { baseUrl };
}

export async function stopTestServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    baseUrl = '';
  }
}

export async function request(path: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}): Promise<{ status: number; body: any; headers: Headers }> {
  const { baseUrl } = await getTestServer();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const init: RequestInit = {
    method: options.method || 'GET',
    headers
  };

  if (options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  let body: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  return {
    status: res.status,
    body,
    headers: res.headers
  };
}

export function resetDatabase() {
  repository.resetForTesting();
}
