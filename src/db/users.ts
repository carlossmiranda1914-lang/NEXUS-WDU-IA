import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name: string, role?: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Tenta encontrar o utilizador diretamente pelo UID do Firebase Auth
    const existingByUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    
    if (existingByUid && existingByUid.length > 0) {
      console.log('[DB-USERS] User found by UID. Updating profile access times and fields...');
      const existingUser = existingByUid[0];
      const updatePayload: any = {
        email: normalizedEmail,
        name,
        lastAccess: new Date(),
      };
      
      if (normalizedEmail === 'carlossmiranda1914@gmail.com') {
        updatePayload.role = 'admin';
        updatePayload.status = 'active';
      }

      const updated = await db.update(users)
        .set(updatePayload)
        .where(eq(users.uid, uid))
        .returning();
      return updated[0] || { ...existingUser, ...updatePayload };
    }

    // 2. Se não encontrar por UID, tenta procurar por email para fazer o binding do UID real
    const existingByEmail = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    
    if (existingByEmail && existingByEmail.length > 0) {
      const existingUser = existingByEmail[0];
      
      // Se já possui um UID ativo (que não seja o placeholder gerado pelo admin começado por 'uid_') e o UID é diferente, lança erro de integridade (eliminação de fallback de memória)
      if (existingUser.uid && existingUser.uid !== uid && !existingUser.uid.startsWith('uid_')) {
        throw new Error(`Integrity error: A user with email ${email} already exists with an active Firebase UID (${existingUser.uid}). No fallback allowed.`);
      }

      console.log('[DB-USERS] User found by Email. Executing secure UID Rebinding/Sync...');
      const updatePayload: any = {
        uid, // Vincula o UID real do Firebase Auth ao registo pré-cadastrado no PostgreSQL
        name,
        lastAccess: new Date(),
      };
      
      if (normalizedEmail === 'carlossmiranda1914@gmail.com') {
        updatePayload.role = 'admin';
        updatePayload.status = 'active';
      }

      const updated = await db.update(users)
        .set(updatePayload)
        .where(eq(users.email, normalizedEmail))
        .returning();
      return updated[0] || { ...existingUser, ...updatePayload };
    }

    // 3. Se não existe de forma alguma, insere um novo utilizador
    console.log('[DB-USERS] User not found by UID or Email. Creating brand new profile in PostgreSQL...');
    const valuesToInsert: any = {
      uid,
      email: normalizedEmail,
      name,
      lastAccess: new Date(),
    };
    
    if (normalizedEmail === 'carlossmiranda1914@gmail.com') {
      valuesToInsert.role = 'admin';
      valuesToInsert.status = 'active';
    } else {
      valuesToInsert.status = 'unverified_email';
      if (role) {
        valuesToInsert.role = role;
      } else {
        valuesToInsert.role = 'student';
      }
    }

    const result = await db.insert(users).values(valuesToInsert).returning();
    if (result && result.length > 0) {
      console.log('[DB-USERS] User successfully registered and synchronized in PostgreSQL.');
      return result[0];
    }
    return { id: 999, ...valuesToInsert };
  } catch (error) {
    console.error('[DB-USERS] Critical database persistence failure in getOrCreateUser:', error);
    throw new Error(`Database error: Authentication and profile persistence in PostgreSQL failed. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getUserProfile(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('[DB-USERS] Failed to fetch user profile:', error);
    return null;
  }
}
