import { getToken } from 'firebase/app-check';
import { appCheck } from './client';

/**
 * Wrapper around `fetch` that attaches a Firebase App Check token in the
 * `X-Firebase-AppCheck` header when App Check is initialized in the browser.
 */
export async function fetchWithAppCheck(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (appCheck) {
    try {
      const { token } = await getToken(appCheck, false);
      if (token) {
        headers.set('X-Firebase-AppCheck', token);
      }
    } catch (error) {
      console.warn('Failed to retrieve App Check token; sending request without token', error);
    }
  }

  return fetch(input, { ...init, headers });
}
