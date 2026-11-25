import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAppCheck, type AppCheck } from 'firebase-admin/app-check';

/**
 * Lazily initializes Firebase Admin and returns the server-side App Check client,
 * or `null` when no server credentials are configured.
 */
export function getAdminAppCheck(): AppCheck | null {
  try {
    const existingApps = getApps();
    let adminApp: App;

    if (existingApps.length > 0) {
      adminApp = existingApps[0];
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        adminApp = initializeApp({
          credential: applicationDefault(),
          projectId: projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else {
        return null;
      }
    }

    return getAppCheck(adminApp);
  } catch (error) {
    console.warn('[AppCheck] Failed to initialize Firebase Admin App Check:', error);
    return null;
  }
}
