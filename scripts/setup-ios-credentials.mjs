import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const secretRoot = path.resolve(root, '.secrets', 'ios');
const ascKeyPath = path.resolve(root, '..', '.secrets', 'appstore-connect', 'AuthKey_XY34QYX65L.p8');
const ciAscKeyPath = path.join(secretRoot, 'AuthKey.p8');
const issuerId = process.env.ASC_API_KEY_ISSUER_ID || 'afd91b00-e91c-4fe6-ab61-d2b2a9d5cd51';
const keyId = process.env.ASC_API_KEY_ID || 'XY34QYX65L';
const bundleId = 'com.onuniverse.overknight';
const appName = 'OverKnight';
const sku = 'com.onuniverse.overknight';

fs.mkdirSync(secretRoot, { recursive: true, mode: 0o700 });

function resolveAscKeyPath() {
  const rawKey = process.env.ASC_API_KEY;
  const base64Key = process.env.ASC_API_KEY_BASE64;

  if (rawKey) {
    fs.writeFileSync(ciAscKeyPath, rawKey.replace(/\\n/g, '\n'), { mode: 0o600 });
    return ciAscKeyPath;
  }

  if (base64Key) {
    fs.writeFileSync(ciAscKeyPath, Buffer.from(base64Key, 'base64').toString('utf8'), { mode: 0o600 });
    return ciAscKeyPath;
  }

  if (fs.existsSync(ascKeyPath)) {
    fs.copyFileSync(ascKeyPath, ciAscKeyPath);
    fs.chmodSync(ciAscKeyPath, 0o600);
    return ciAscKeyPath;
  }

  return ciAscKeyPath;
}

const resolvedAscKeyPath = resolveAscKeyPath();

function writeBase64File(envName, outputPath) {
  const value = process.env[envName];
  if (!value) return false;
  fs.writeFileSync(outputPath, Buffer.from(value, 'base64'), { mode: 0o600 });
  return true;
}

function restoreCredentialsFromEnvironment() {
  const p12Path = path.join(secretRoot, 'overknight-ios-distribution.p12');
  const profilePath = path.join(secretRoot, 'overknight-app-store.mobileprovision');
  const restoredP12 = writeBase64File('IOS_DIST_P12_BASE64', p12Path);
  const restoredProfile = writeBase64File('IOS_PROVISIONING_PROFILE_BASE64', profilePath);
  const password = process.env.IOS_DIST_P12_PASSWORD;

  if (!restoredP12 && !restoredProfile && !password) return false;
  if (!restoredP12 || !restoredProfile || !password) {
    throw new Error('IOS_DIST_P12_BASE64, IOS_DIST_P12_PASSWORD, and IOS_PROVISIONING_PROFILE_BASE64 must be set together.');
  }

  writeCredentials(p12Path, password, profilePath);
  return true;
}

const b64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

function jwt() {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: issuerId,
    exp: Math.floor(Date.now() / 1000) + 20 * 60,
    aud: 'appstoreconnect-v1',
  }));
  const data = `${header}.${payload}`;
  const signature = crypto.sign('sha256', Buffer.from(data), {
    key: fs.readFileSync(resolvedAscKeyPath, 'utf8'),
    dsaEncoding: 'ieee-p1363',
  });
  return `${data}.${b64url(signature)}`;
}

async function api(pathname, options = {}) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function findBundleId() {
  const json = await api(`/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&limit=1`);
  return json.data?.[0] || null;
}

async function ensureBundleId() {
  const existing = await findBundleId();
  if (existing) return existing;
  const json = await api('/bundleIds', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: bundleId,
          name: appName,
          platform: 'IOS',
        },
      },
    }),
  });
  return json.data;
}

async function createCertificate() {
  const keyPath = path.join(secretRoot, 'overknight-ios-distribution.key');
  const csrPath = path.join(secretRoot, 'overknight-ios-distribution.csr');
  const cerPath = path.join(secretRoot, 'overknight-ios-distribution.cer');
  const p12Path = path.join(secretRoot, 'overknight-ios-distribution.p12');
  const passwordPath = path.join(secretRoot, 'p12-password.txt');

  if (!fs.existsSync(keyPath)) {
    execFileSync('openssl', ['genrsa', '-out', keyPath, '2048'], { stdio: 'ignore' });
    fs.chmodSync(keyPath, 0o600);
  }
  execFileSync('openssl', [
    'req',
    '-new',
    '-key',
    keyPath,
    '-out',
    csrPath,
    '-subj',
    `/CN=${appName} iOS Distribution`,
  ], { stdio: 'ignore' });

  const csrContent = fs.readFileSync(csrPath, 'utf8');
  const json = await api('/certificates', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'certificates',
        attributes: {
          certificateType: 'IOS_DISTRIBUTION',
          csrContent,
        },
      },
    }),
  });

  const cert = json.data;
  fs.writeFileSync(cerPath, Buffer.from(cert.attributes.certificateContent, 'base64'), { mode: 0o600 });
  const password = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(passwordPath, password, { mode: 0o600 });
  execFileSync('openssl', [
    'pkcs12',
    '-export',
    '-inkey',
    keyPath,
    '-in',
    cerPath,
    '-out',
    p12Path,
    '-passout',
    `pass:${password}`,
  ], { stdio: 'ignore' });
  fs.chmodSync(p12Path, 0o600);

  return { id: cert.id, p12Path, password };
}

async function createProfile(bundle, certificateId) {
  const profilePath = path.join(secretRoot, 'overknight-app-store.mobileprovision');
  const json = await api('/profiles', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'profiles',
        attributes: {
          name: `${appName} App Store ${Date.now()}`,
          profileType: 'IOS_APP_STORE',
        },
        relationships: {
          bundleId: {
            data: { type: 'bundleIds', id: bundle.id },
          },
          certificates: {
            data: [{ type: 'certificates', id: certificateId }],
          },
        },
      },
    }),
  });
  fs.writeFileSync(profilePath, Buffer.from(json.data.attributes.profileContent, 'base64'), { mode: 0o600 });
  return profilePath;
}

async function ensureApp() {
  const existing = await api(`/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`).catch(() => ({ data: [] }));
  if (existing.data?.length) return existing.data[0];
  const json = await api('/apps', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'apps',
        attributes: {
          bundleId,
          name: appName,
          primaryLocale: 'en-US',
          sku,
        },
      },
    }),
  });
  return json.data;
}

function writeCredentials(p12Path, password, profilePath) {
  const credentials = {
    ios: {
      distributionCertificate: {
        path: path.relative(root, p12Path),
        password,
      },
      provisioningProfilePath: path.relative(root, profilePath),
    },
  };
  fs.writeFileSync(path.join(root, 'credentials.json'), `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
}

const bundle = await ensureBundleId();
if (restoreCredentialsFromEnvironment()) {
  const app = await ensureApp().catch((error) => ({ error: error.message }));
  console.log(JSON.stringify({
    bundleId,
    bundleResourceId: bundle.id,
    credentials: 'restored-from-environment',
    app,
  }, null, 2));
  process.exit(0);
}

const certificate = await createCertificate();
const profilePath = await createProfile(bundle, certificate.id);
writeCredentials(certificate.p12Path, certificate.password, profilePath);
const app = await ensureApp().catch((error) => ({ error: error.message }));

console.log(JSON.stringify({
  bundleId: bundleId,
  bundleResourceId: bundle.id,
  certificateId: certificate.id,
  provisioningProfile: path.relative(root, profilePath),
  app,
}, null, 2));
