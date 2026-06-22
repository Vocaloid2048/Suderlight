/**
 * 统一 API 客户端 — 替代分散在各组件中的裸 fetch 调用。
 *
 * 用法:
 *   import { apiClient } from '@/lib/api-client';
 *   const data = await apiClient.get<MyType>('/api/health');
 *   const result = await apiClient.post<MyType>('/api/chat', { npcId: '...', message: '...' });
 */

import { getPlayerAuthHeaders } from './playerId';

const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly body: Record<string, unknown> | null;

  constructor(status: number, body: Record<string, unknown> | null) {
    const detail = typeof body?.detail === 'string' ? body.detail : body?.error;
    super(String(detail ?? `API error ${status}`));
    this.name = 'ApiError';
    this.status = status;
    this.code = typeof body?.code === 'string' ? body.code : 'UNKNOWN';
    this.body = body;
  }
}

/**
 * 将 API 错误映射为用户可读的中文消息
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
      case 422:
        return '輸入格式有誤，請檢查後重新發送。';
      case 404:
        return '找不到該資料，請重新整理頁面。';
      case 429:
        return '操作太快了，請稍等片刻後再試。';
      case 500:
        return '伺服器繁忙，請稍後再試。';
      default:
        return '發生錯誤，請稍後再試。';
    }
  }
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return '無法連線到伺服器，請檢查網路連線。';
  }
  return '發生未預期的錯誤，請重新整理。';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000); // 45s 超时

  try {
    const authHeaders = await getPlayerAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, data: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
