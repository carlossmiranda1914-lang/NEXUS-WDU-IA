import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name: string, role?: string) {
  console.log(`[DB-USERS] Entering getOrCreateUser: uid=${uid}, email=${email}, name=${name}, role=${role}`);
  try {
    console.log('[DB-USERS] Attempting to insert/update user row in PostgreSQL...');
    const valuesToInsert: any = {
      uid,
      email,
      name,
      lastAccess: new Date(),
    };
    if (role) {
      valuesToInsert.role = role;
    }
    const result = await db.insert(users)
      .values(valuesToInsert)
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name,
          lastAccess: new Date(),
        },
      })
      .returning();

    if (result && result.length > 0) {
      console.log('[DB-USERS] User successfully inserted/updated in PostgreSQL:', result[0]);
      return result[0];
    }
    throw new Error('PostgreSQL insert/update returned empty result');
  } catch (error) {
    console.warn('[DB-USERS] insert/update failed, executing select fallback path...', error);
    try {
      console.log('[DB-USERS] Executing fallback select query for uid:', uid);
      const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (existing && existing.length > 0) {
        console.log('[DB-USERS] Select fallback found existing user profile:', existing[0]);
        try {
          await db.update(users).set({ lastAccess: new Date() }).where(eq(users.uid, uid));
          console.log('[DB-USERS] Successfully updated lastAccess timestamp.');
        } catch (updateErr) {
          console.warn('[DB-USERS] Non-blocking warning: Failed to update lastAccess timestamp:', updateErr);
        }
        return existing[0];
      }
    } catch (fallbackSelectErr) {
      console.error('[DB-USERS] Fallback select query also failed:', fallbackSelectErr);
    }
    
    // STRICT ENTERPRISE MANDATE: throw if we cannot authenticate via DB
    console.error('[DB-USERS] Critical database persistence failure. No in-memory fallback permitted.');
    throw new Error(`Database error: Authentication and profile persistence in PostgreSQL failed. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getUserProfile(uid: string) {
  console.log(`[DB-USERS] Entering getUserProfile: uid=${uid}`);
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    console.log('[DB-USERS] getUserProfile query result:', result[0] || 'not found');
    return result[0] || null;
  } catch (error) {
    console.error('[DB-USERS] Failed to fetch user profile:', error);
    return null;
  }
}
