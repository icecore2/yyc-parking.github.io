import { NextRequest, NextResponse } from 'next/server';
import { getAdminAppCheck } from './admin';

/**
 * Verifies the `X-Firebase-AppCheck` header on incoming API requests.
 * Returns `null` if the request is allowed to proceed, or an error response
 * (401/503) if verification fails.
 */
export async function verifyAppCheckRequest(req: NextRequest): Promise<NextResponse | null> {
  const adminAppCheck = getAdminAppCheck();

  if (!adminAppCheck) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'App verification unavailable' }, { status: 503 });
    }
    console.warn('[AppCheck] admin not configured; skipping verification in dev');
    return null;
  }

  const token = req.headers.get('x-firebase-appcheck');
  if (!token) {
    return NextResponse.json({ error: 'App verification failed' }, { status: 401 });
  }

  try {
    await adminAppCheck.verifyToken(token);
    return null;
  } catch {
    return NextResponse.json({ error: 'App verification failed' }, { status: 401 });
  }
}
