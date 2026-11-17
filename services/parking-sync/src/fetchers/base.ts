import type { NormalizedParkingRecord, ProviderName } from '../types.ts';

export abstract class BaseProviderFetcher {
  abstract readonly providerName: ProviderName;
  abstract readonly providerId: string;

  abstract fetchRecords(): Promise<NormalizedParkingRecord[]>;

  protected async fetchJsonWithTimeout<T>(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = 10000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'CalgaryParkingSyncService/1.0',
          ...(options.headers || {}),
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status} (${res.statusText}) from ${url}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
