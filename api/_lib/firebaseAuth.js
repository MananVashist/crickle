/**
 * Verify the caller's Firebase ID token, and get the uid from the TOKEN.
 *
 * WHY. Before this, every h2h route took the uid from the query string or the
 * request body and trusted it. `GET /api/h2h/friends?uid=<someone else>`
 * returned that person's friend list, with no authentication anywhere in the
 * request. Locking the tables down with RLS would not have touched that: these
 * routes run as service_role and bypass RLS by design, so the only thing that
 * can decide whether a caller may act as a uid is the route itself.
 *
 * The uid must therefore come from a signature we can check, not from a
 * parameter the caller chose.
 *
 * NO NEW DEPENDENCY, NO NEW SECRET. firebase-admin was already a dependency and
 * is already initialised in production from FIREBASE_PROJECT_ID /
 * FIREBASE_CLIENT_EMAIL / FIREBASE_SERVICE_ACCOUNT_KEY — challenge-new.js and
 * challenge-submit.js each had their own copy of that init block to send push
 * notifications. This is that same block, extracted, so verification costs
 * nothing to deploy and the two copies stop drifting.
 *
 * verifyIdToken() checks the signature, issuer, audience and expiry against
 * Google's keys. A token from another Firebase project, an expired one, or one
 * with a forged payload all fail.
 */

let adminPromise = null;

async function getAdmin() {
  if (!adminPromise) {
    adminPromise = (async () => {
      const adminModule = await import('firebase-admin');
      const admin = adminModule.default || adminModule;

      if (!admin.apps.length) {
        // The key arrives as an env var, so it carries literal \n rather than
        // newlines, and Vercel's UI sometimes wraps it in quotes. Both are
        // stripped here exactly as the original inline copies did.
        let privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (privateKey) privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
          throw new Error('Missing Firebase environment variables');
        }
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      }
      return admin;
    })().catch((e) => {
      // Do not cache a failed init: a cold start that happened to race a
      // missing env var would otherwise poison every later request on that
      // instance.
      adminPromise = null;
      throw e;
    });
  }
  return adminPromise;
}

export { getAdmin };

/**
 * Returns the verified uid, or null if the request is not properly
 * authenticated. Never throws for a bad token — a caller with no token and a
 * caller with a forged one are the same answer, and neither deserves a stack
 * trace.
 */
export async function verifiedUid(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  try {
    const admin = await getAdmin();
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded?.uid || null;
  } catch (err) {
    // Logged, and the two causes are told apart deliberately.
    //
    // A rejected token and a broken verifier both produce 401, which makes them
    // indistinguishable from outside — and they could not be more different: one
    // is the check working, the other is every signed-in user locked out of a
    // live app. Swallowing this silently meant a deployment could look correctly
    // secured while being entirely broken, so the distinction is printed.
    const msg = err?.message || String(err);
    if (/environment variables|credential|initializeApp/i.test(msg)) {
      console.error(`[auth] VERIFIER BROKEN — every signed-in user will get 401: ${msg}`);
    } else {
      console.warn(`[auth] token rejected: ${msg}`);
    }
    return null;
  }
}

/**
 * Convenience wrapper: verifies, and writes the 401 itself if there is no
 * valid caller. Returns the uid, or null once the response has been sent.
 *
 * Deliberately one call so a route cannot accidentally continue after a failed
 * check — the pattern `const uid = await requireUid(req, res); if (!uid) return;`
 * is hard to get half-right.
 */
export async function requireUid(req, res) {
  const uid = await verifiedUid(req);
  if (!uid) {
    res.status(401).json({ error: 'Sign-in required' });
    return null;
  }
  return uid;
}
