import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const repo = process.argv[2];

if (!repo) {
  console.error('Usage: node scripts/configure-github-secrets.mjs OWNER/REPO');
  process.exit(1);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

function setSecret(name, value) {
  execFileSync('gh', ['secret', 'set', name, '--repo', repo, '--body', value], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

const ascKey = readRequired(path.resolve(root, '..', '.secrets', 'appstore-connect', 'AuthKey_XY34QYX65L.p8'));
const credentials = JSON.parse(readRequired(path.join(root, 'credentials.json')).toString('utf8'));
const p12 = readRequired(path.join(root, credentials.ios.distributionCertificate.path));
const profile = readRequired(path.join(root, credentials.ios.provisioningProfilePath));

setSecret('ASC_API_KEY_ID', 'XY34QYX65L');
setSecret('ASC_API_KEY_ISSUER_ID', 'afd91b00-e91c-4fe6-ab61-d2b2a9d5cd51');
setSecret('ASC_API_KEY_BASE64', ascKey.toString('base64'));
setSecret('IOS_DIST_P12_BASE64', p12.toString('base64'));
setSecret('IOS_DIST_P12_PASSWORD', credentials.ios.distributionCertificate.password);
setSecret('IOS_PROVISIONING_PROFILE_BASE64', profile.toString('base64'));

console.log(`Configured GitHub Actions secrets for ${repo}.`);
