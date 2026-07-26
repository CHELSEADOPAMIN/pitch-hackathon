import { hc } from 'hono/client';

import type { AppType } from '../../server/app';
import { getApiUrl } from './runtime-config';

export const api = hc<AppType>(getApiUrl());

type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export async function readJson<T>(
  response: JsonResponse,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return schema.parse(payload);
}
