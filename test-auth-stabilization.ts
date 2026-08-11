import dotenv from 'dotenv';
dotenv.config();

// Disable Drizzle-level in-memory fallback for these tests to verify real database constraints
process.env.DISABLE_DB_FALLBACK = 'true';

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './src/db/schema.ts';
import { createTestDatabasePool, reportSkippedDatabaseTest } from './src/db/test-database.ts';

const pool = createTestDatabasePool();
const db = pool ? drizzle(pool, { schema }) : null;
const { users } = schema;

async function runAuthTests() {
  if (!pool || !db) {
    reportSkippedDatabaseTest('AUTH-TEST');
    return;
  }
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { getOrCreateUser, getUserProfile } = await import('./src/db/users.ts');
  console.log('==================================================');
  console.log('    INICIANDO TESTES DE ESTABILIZAÇÃO DE AUTENTICAÇÃO');
  console.log('==================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    console.log(`[AUTH-TEST ${totalTests}] ${name}...`);
    try {
      await fn();
      console.log(`✅ PASS: ${name}\n`);
      passedTests++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message || err}\n`);
    }
  }

  async function cleanup(testUid: string) {
    try {
      await db.delete(users).where(eq(users.uid, testUid));
    } catch (e) {
      // Ignore cleanup failures
    }
  }

  try {
    const TEST_UID_1 = 'auth_test_uid_student_123';
    const TEST_EMAIL_1 = 'student_test_auth@nexus.edu';
    const TEST_NAME_1 = 'Test Student Auth';

    await cleanup(TEST_UID_1);

    // Test 1: PostgreSQL User Persistence (getOrCreateUser)
    await test('Persistência e Criação de Utilizador no PostgreSQL', async () => {
      // Call getOrCreateUser to create a user for the first time
      const user = await getOrCreateUser(TEST_UID_1, TEST_EMAIL_1, TEST_NAME_1, 'student');
      
      if (!user) {
        throw new Error('getOrCreateUser retornou um resultado nulo.');
      }
      if (user.uid !== TEST_UID_1 || user.role !== 'student') {
        throw new Error('Propriedades do utilizador criado incorretas.');
      }

      // Verify actually exists in the database
      const dbUsers = await db.select().from(users).where(eq(users.uid, TEST_UID_1)).limit(1);
      if (dbUsers.length === 0) {
        throw new Error('Utilizador não foi persistido no PostgreSQL.');
      }
      if (dbUsers[0].role !== 'student') {
        throw new Error('Papel (role) de utilizador não foi gravado como default ("student").');
      }
    });

    // Test 2: Role update and consistency (POST /api/profile/role mechanism)
    await test('Sincronização de Papel (Role) e Atualização de Perfil', async () => {
      // Update role in DB
      await db.update(users).set({ role: 'teacher' }).where(eq(users.uid, TEST_UID_1));

      // Retrieve via getUserProfile to check synchronization
      const profile = await getUserProfile(TEST_UID_1);
      if (!profile) {
        throw new Error('Falha ao recuperar o perfil do utilizador.');
      }
      if (profile.role !== 'teacher') {
        throw new Error(`O papel do utilizador deveria ser "teacher", mas foi retornado: "${profile.role}"`);
      }
    });

    // Test 3: No conflict updates (onConflictDoUpdate) keeps role unchanged
    await test('onConflictDoUpdate do getOrCreateUser preserva papel customizado', async () => {
      // Call getOrCreateUser again for same uid
      const user = await getOrCreateUser(TEST_UID_1, TEST_EMAIL_1, 'Updated Test Student Name', 'student');
      
      if (user.role !== 'teacher') {
        throw new Error(`Erro: getOrCreateUser sobrescreveu o papel customizado "teacher" com o default "student". Papel atual: "${user.role}"`);
      }
      if (user.name !== 'Updated Test Student Name') {
        throw new Error('O nome do utilizador deveria ter sido atualizado no conflito.');
      }
    });

    // Test 4: Eliminating Memory Fallback and Forcing Failure
    await test('Eliminação de fallback de memória - lançar erro se persistência falhar', async () => {
      // Clean up target test uids
      await cleanup('test_u1');
      await cleanup('test_u2');

      // First create user A with email 'same_email@nexus.edu' and uid 'test_u1'
      await getOrCreateUser('test_u1', 'same_email@nexus.edu', 'User A', 'student');

      let threwError = false;
      try {
        // Intentionally violate UNIQUE constraint on email by creating another user with uid 'test_u2' but same email
        await getOrCreateUser('test_u2', 'same_email@nexus.edu', 'User B', 'student');
      } catch (err: any) {
        threwError = true;
        console.log('   (Erro lançado corretamente como esperado: No in-memory fallback permitted)');
      }

      // Cleanup
      await cleanup('test_u1');
      await cleanup('test_u2');

      if (!threwError) {
        throw new Error('O sistema deveria ter lançado um erro em vez de usar fallback de memória.');
      }
    });

    // Test 5: Account Suspension Flow
    await test('Bloqueio e Verificação de Contas Suspensas', async () => {
      // Set status to suspended in database
      await db.update(users).set({ status: 'suspended' }).where(eq(users.uid, TEST_UID_1));

      const profile = await getUserProfile(TEST_UID_1);
      if (!profile || profile.status !== 'suspended') {
        throw new Error('Falha ao marcar conta como suspensa no PostgreSQL.');
      }
    });

    await cleanup(TEST_UID_1);

    console.log('==================================================');
    console.log(`RELATÓRIO AUTH: ${passedTests}/${totalTests} TESTES COM SUCESSO`);
    console.log('==================================================');

  } catch (err: any) {
    console.error('Erro fatal durante execução dos testes de autenticação:', err);
  } finally {
    pool.end();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

runAuthTests();
