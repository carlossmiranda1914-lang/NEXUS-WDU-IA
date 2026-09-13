import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';

const gcloud = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
const project = 'nexus-wdu-staging';
const region = 'europe-west1';
const instanceName = 'nexus-staging-postgres';
const dbName = 'nexus_staging';
const dbUser = 'nexus_staging_app';

async function main() {
  console.log('1. Waiting for Cloud SQL instance to be RUNNABLE...');
  let ipAddress = '';
  while (true) {
    try {
      const output = execSync(`"${gcloud}" sql instances describe ${instanceName} --project=${project} --format=json`, { encoding: 'utf8' });
      const parsed = JSON.parse(output);
      if (parsed.state === 'RUNNABLE') {
        const ip = parsed.ipAddresses?.find(i => i.type === 'PRIMARY')?.ipAddress;
        if (ip) {
          ipAddress = ip;
          console.log(`Cloud SQL instance is RUNNABLE at IP: ${ipAddress}`);
          break;
        }
      }
    } catch (err) {
      console.log('Instance not ready yet, waiting 10s...');
    }
    await new Promise(r => setTimeout(r, 10000));
  }

  console.log('2. Creating database', dbName);
  try {
    execSync(`"${gcloud}" sql databases create ${dbName} --instance=${instanceName} --project=${project}`, { stdio: 'inherit' });
  } catch (err) {
    console.log('Database may already exist:', err.message);
  }

  console.log('3. Creating application user', dbUser);
  const userPassword = randomBytes(24).toString('hex');
  try {
    execSync(`"${gcloud}" sql users create ${dbUser} --instance=${instanceName} --project=${project} --password=${userPassword}`, { stdio: 'inherit' });
  } catch (err) {
    console.log('Setting password for existing user...');
    execSync(`"${gcloud}" sql users set-password ${dbUser} --instance=${instanceName} --project=${project} --password=${userPassword}`, { stdio: 'inherit' });
  }

  console.log('4. Authorizing current client IP for migration execution...');
  // Get our public IP
  const myIpRes = await fetch('https://api.ipify.org?format=json');
  const myResJson = await myIpRes.json() as { ip: string };
  const myIp = myResJson.ip;
  console.log(`Current runner IP: ${myIp}`);

  execSync(`"${gcloud}" sql instances patch ${instanceName} --project=${project} --authorized-networks=${myIp}/32 --quiet`, { stdio: 'inherit' });

  const directDbUrl = `postgresql://${dbUser}:${userPassword}@${ipAddress}:5432/${dbName}?sslmode=disable`;
  const cloudRunDbUrl = `postgresql://${dbUser}:${userPassword}@127.0.0.1:5432/${dbName}?host=/cloudsql/${project}:${region}:${instanceName}`;

  console.log('5. Storing DATABASE_URL into Secret Manager...');
  try {
    execSync(`"${gcloud}" secrets create DATABASE_URL --project=${project} --replication-policy=automatic`, { stdio: 'ignore' });
  } catch (e) {}
  execSync(`"${gcloud}" secrets versions add DATABASE_URL --project=${project} --data-file=-`, {
    input: cloudRunDbUrl,
    stdio: ['pipe', 'inherit', 'inherit']
  });

  console.log('6. Running migrations against Cloud SQL database...');
  const migrationsDirectory = path.resolve('src/db/migrations');
  const migrations = await discoverMigrations(migrationsDirectory);
  console.log(`Discovered ${migrations.length} migrations.`);

  const pool = new pg.Pool({
    connectionString: directDbUrl,
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    const applied = await runMigrations(client, migrations);
    console.log(`[MIGRATIONS SUCCESS] ${applied.length} migration(s) applied to Cloud SQL ${dbName}!`);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('7. Granting Cloud Run service account access to DATABASE_URL secret...');
  const sa = 'nexus-documents-staging-sa@nexus-wdu-staging.iam.gserviceaccount.com';
  execSync(`"${gcloud}" secrets add-iam-policy-binding DATABASE_URL --project=${project} --member=serviceAccount:${sa} --role=roles/secretmanager.secretAccessor --quiet`, { stdio: 'inherit' });

  console.log('8. Granting Cloud SQL Client role to Cloud Run service account...');
  execSync(`"${gcloud}" projects add-iam-policy-binding ${project} --member=serviceAccount:${sa} --role=roles/cloudsql.client --quiet`, { stdio: 'inherit' });

  console.log('DATABASE SETUP AND MIGRATIONS COMPLETED SUCCESSFULLY.');
}

main().catch(err => {
  console.error('DATABASE SETUP ERROR:', err);
  process.exit(1);
});
