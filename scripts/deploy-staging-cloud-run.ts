import { execSync } from 'node:child_process';

const gcloud = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
const project = 'nexus-wdu-staging';
const region = 'europe-west1';
const service = 'nexus-wdu-staging';
const instanceConnection = `${project}:${region}:nexus-staging-postgres`;
const sa = 'nexus-documents-staging-sa@nexus-wdu-staging.iam.gserviceaccount.com';

console.log('Deploying to Cloud Run with staging-env.yaml...');
const cmd =
  `"${gcloud}" run deploy ${service} ` +
  `--source=. ` +
  `--project=${project} ` +
  `--region=${region} ` +
  `--service-account=${sa} ` +
  `--allow-unauthenticated ` +
  `--add-cloudsql-instances=${instanceConnection} ` +
  `--set-secrets=DATABASE_URL=DATABASE_URL:latest,DOCUMENTS_ACCESS_GRANT_TOKEN_KEY=DOCUMENTS_ACCESS_GRANT_TOKEN_KEY:latest,DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY=DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY:latest ` +
  `--env-vars-file=staging-env.yaml ` +
  `--quiet`;

execSync(cmd, { stdio: 'inherit' });
console.log('DEPLOYMENT TO CLOUD RUN COMPLETED.');
