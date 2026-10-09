const test = require('node:test');
const assert = require('node:assert/strict');
const clientModule = import('../../scripts/virustotal-client.mts');
const secret = 'unit-test-secret-not-a-real-key';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const scanModule = import('../../scripts/scan-virustotal.mts');
const cleanStats = { malicious: 0, suspicious: 0, undetected: 3, harmless: 1 };

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-virus-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'main.js'), '// public plugin fixture');
  await fs.writeFile(path.join(directory, 'styles.css'), '.mermaid { color: black; }');
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ id: 'mermaid-flow-enhancer', version: '0.1.2' }));
  await fs.writeFile(path.join(directory, 'private-note.md'), 'PRIVATE MUST NEVER UPLOAD');
  return { directory, output: path.join(directory, 'reports') };
}

function scanClient(stats = cleanStats) {
  const uploads = [];
  return { uploads, async request(apiPath, options) {
    if (apiPath === '/files') {
      const file = options.body.get('file');
      uploads.push({ name: file.name, bytes: Buffer.from(await file.arrayBuffer()) });
      return { data: { id: `analysis-${uploads.length}` } };
    }
    const file = uploads.at(-1);
    return { data: { attributes: { status: 'completed', stats } },
      meta: { file_info: { sha256: createHash('sha256').update(file.bytes).digest('hex') } } };
  } };
}

function response(status, payload) {
  return { status, ok: status >= 200 && status < 300,
    headers: new Headers(), json: async () => payload };
}

function clock() {
  let time = 0;
  const waits = [];
  return { now: () => time, sleep: async (ms) => { waits.push(ms); time += ms; }, waits };
}

test('VirusTotal verdict distinguishes complete clean, flagged, and pending analyses', async () => {
  const { verdict } = await clientModule;
  assert.deepEqual(verdict({ status: 'queued' }), { status: 'pending' });
  assert.deepEqual(verdict({ status: 'in-progress', stats: { malicious: 1 } }), { status: 'pending' });
  assert.deepEqual(verdict({ status: 'completed', stats: {
    malicious: 0, suspicious: 0, undetected: 5, harmless: 2, timeout: 1,
  } }), { status: 'no-detections', detected: 0, analyzed: 7 });
  assert.deepEqual(verdict({ status: 'completed', stats: {
    malicious: 2, suspicious: 1, undetected: 5, harmless: 2,
  } }), { status: 'flagged', detected: 3, analyzed: 10 });
});

test('VirusTotal verdict fails closed for missing, malformed, and unsupported statistics', async () => {
  const { verdict } = await clientModule;
  const valid = { malicious: 0, suspicious: 0, undetected: 1, harmless: 0 };
  for (const stats of [undefined, null, [], {}, { ...valid, malicious: -1 },
    { ...valid, suspicious: 0.5 }, { ...valid, undetected: '1' },
    { ...valid, timeout: NaN }, { ...valid, harmless: Infinity },
    { malicious: 0, suspicious: 0, undetected: 0, harmless: 0 },
    { malicious: 0, suspicious: 0, undetected: 0, harmless: 0, timeout: 3 }]) {
    assert.throws(() => verdict({ status: 'completed', stats }));
  }
});

test('VirusTotal requests use the fixed API, authenticate, and prohibit redirects', async () => {
  const { createClient } = await clientModule;
  const calls = [];
  const fake = clock();
  const body = new FormData();
  body.append('file', new Blob(['fixture']), 'fixture.js');
  const client = createClient({ apiKey: secret, ...fake,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return response(200, { data: { id: 'analysis-id' } }); } });
  assert.deepEqual(await client.request('/files', { method: 'POST', body }), { data: { id: 'analysis-id' } });
  assert.equal(calls[0].url, 'https://www.virustotal.com/api/v3/files');
  assert.equal(new Headers(calls[0].options.headers).get('x-apikey'), secret);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.body, body);
  assert.equal(calls[0].options.method, 'POST');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('VirusTotal rejects missing credentials and paths that could expose the API key', async () => {
  const { createClient } = await clientModule;
  for (const apiKey of [undefined, '', '   ']) assert.throws(() => createClient({ apiKey }));
  let calls = 0;
  const client = createClient({ apiKey: secret, ...clock(),
    fetchImpl: async () => { calls++; return response(200, {}); } });
  for (const path of ['https://example.com/files', '//example.com/files', 'files',
    '/files?key=bad', '/analyses/a#fragment', '/unknown']) {
    await assert.rejects(client.request(path), (error) => !error.message.includes(secret));
  }
  assert.equal(calls, 0);
});

test('VirusTotal requests enforce the public API interval without real delays', async () => {
  const { createClient } = await clientModule;
  const fake = clock();
  const starts = [];
  const client = createClient({ apiKey: secret, ...fake, intervalMs: 16000,
    fetchImpl: async () => { starts.push(fake.now()); return response(200, { data: {} }); } });
  await client.request('/files/a');
  await client.request('/files/b');
  await client.request('/files/c');
  assert.equal(starts.length, 3);
  assert.ok(starts[1] - starts[0] >= 16000);
  assert.ok(starts[2] - starts[1] >= 16000);
});

test('VirusTotal retries temporary HTTP failures and bounds exhausted attempts', async () => {
  const { createClient } = await clientModule;
  let calls = 0;
  const fake = clock();
  const client = createClient({ apiKey: secret, ...fake, intervalMs: 1, maxAttempts: 4,
    fetchImpl: async () => response([429, 503, 200][calls++], { data: { id: 'ok' } }) });
  assert.deepEqual(await client.request('/analyses/a'), { data: { id: 'ok' } });
  assert.equal(calls, 3);
  assert.ok(fake.waits.every((ms) => Number.isFinite(ms) && ms >= 0));
  calls = 0;
  const failing = createClient({ apiKey: secret, ...clock(), intervalMs: 1, maxAttempts: 4,
    fetchImpl: async () => { calls++; return response(503, { error: { message: secret } }); } });
  await assert.rejects(failing.request('/files/a'), (error) => !error.message.includes(secret));
  assert.equal(calls, 4);
});

test('VirusTotal authentication failures are not retried or exposed with secret data', async () => {
  const { createClient } = await clientModule;
  let calls = 0;
  const client = createClient({ apiKey: secret, ...clock(),
    fetchImpl: async () => { calls++; return response(401, { error: { message: secret } }); } });
  await assert.rejects(client.request('/files/a'), (error) => !error.message.includes(secret));
  assert.equal(calls, 1);
});

test('VirusTotal rejects malformed JSON without leaking fetch or response secrets', async () => {
  const { createClient } = await clientModule;
  const client = createClient({ apiKey: secret, ...clock(),
    fetchImpl: async () => ({ ...response(200, null), json: async () => { throw new SyntaxError(secret); } }) });
  await assert.rejects(client.request('/files/a'), (error) => !error.message.includes(secret));
  const networkFailure = createClient({ apiKey: secret, ...clock(), intervalMs: 1,
    fetchImpl: async () => { throw new Error(secret); } });
  await assert.rejects(networkFailure.request('/files/a'), (error) => !error.message.includes(secret));
});

test('release scan uploads only three public artifacts and writes verifiable hash reports', async (t) => {
  const { scanRelease } = await scanModule;
  const locations = await fixture(t);
  const client = scanClient();
  const result = await scanRelease({ ...locations, client });
  assert.equal(result.status, 'no-detections');
  assert.deepEqual(client.uploads.map(file => file.name), ['main.js', 'manifest.json', 'styles.css']);
  for (const file of client.uploads) {
    assert.deepEqual(file.bytes, await fs.readFile(path.join(locations.directory, file.name)));
    const hash = createHash('sha256').update(file.bytes).digest('hex');
    const item = result.files.find(item => item.name === file.name);
    assert.equal(item.sha256, hash);
    assert.equal(item.url, `https://www.virustotal.com/gui/file/${hash}`);
  }
  const saved = JSON.parse(await fs.readFile(path.join(locations.output, 'virustotal-report.json'), 'utf8'));
  assert.equal(saved.status, 'no-detections');
  const markdown = await fs.readFile(path.join(locations.output, 'virustotal-report.md'), 'utf8');
  assert.ok(markdown.includes(result.files[0].sha256));
  assert.ok(!JSON.stringify(saved).includes('PRIVATE MUST NEVER UPLOAD'));
});

test('release scan blocks detections and persists the flagged verdict', async (t) => {
  const { scanRelease } = await scanModule;
  const locations = await fixture(t);
  await assert.rejects(scanRelease({ ...locations,
    client: scanClient({ ...cleanStats, suspicious: 1 }) }), /blocked/);
  const saved = JSON.parse(await fs.readFile(path.join(locations.output, 'virustotal-report.json'), 'utf8'));
  assert.equal(saved.status, 'flagged');
  assert.ok(saved.files.every(file => file.detected === 1));
});

test('release scan fails closed when pending analysis reaches its deadline', async (t) => {
  const { scanRelease } = await scanModule;
  const locations = await fixture(t);
  let time = 0;
  const client = { async request(apiPath) {
    time += 10;
    return apiPath === '/files' ? { data: { id: 'pending' } }
      : { data: { attributes: { status: 'queued' } } };
  } };
  await assert.rejects(scanRelease({ ...locations, client, now: () => time, timeoutMs: 30 }), /timed out/);
  const saved = JSON.parse(await fs.readFile(path.join(locations.output, 'virustotal-report.json'), 'utf8'));
  assert.equal(saved.status, 'incomplete');
  assert.equal(saved.files[0].status, 'pending');
});

test('release scan rejects mismatched remote hashes and malformed API responses', async (t) => {
  const { scanRelease } = await scanModule;
  for (const mode of ['hash', 'missing-id', 'invalid-stats']) {
    const locations = await fixture(t);
    const client = { async request(apiPath) {
      if (apiPath === '/files') return { data: mode === 'missing-id' ? {} : { id: 'a' } };
      return { data: { attributes: { status: 'completed', stats: mode === 'invalid-stats' ? {} : cleanStats } },
        meta: mode === 'hash' ? { file_info: { sha256: 'wrong' } } : {} };
    } };
    await assert.rejects(scanRelease({ ...locations, client }));
    const saved = JSON.parse(await fs.readFile(path.join(locations.output, 'virustotal-report.json'), 'utf8'));
    assert.equal(saved.status, 'incomplete');
  }
});

test('release scan preflights all files before upload and rejects symbolic links', async (t) => {
  const { scanRelease } = await scanModule;
  const locations = await fixture(t);
  await fs.unlink(path.join(locations.directory, 'styles.css'));
  await fs.symlink(path.join(locations.directory, 'private-note.md'), path.join(locations.directory, 'styles.css'));
  const client = scanClient();
  await assert.rejects(scanRelease({ ...locations, client }), /regular release file/);
  assert.equal(client.uploads.length, 0);
});

test('release scan detects artifacts modified after upload', async (t) => {
  const { scanRelease } = await scanModule;
  const locations = await fixture(t);
  const client = scanClient();
  const originalRequest = client.request.bind(client);
  client.request = async (...args) => {
    const result = await originalRequest(...args);
    if (client.uploads.length === 3) await fs.writeFile(path.join(locations.directory, 'main.js'), '// changed');
    return result;
  };
  await assert.rejects(scanRelease({ ...locations, client }), /changed during scanning/);
  const saved = JSON.parse(await fs.readFile(path.join(locations.output, 'virustotal-report.json'), 'utf8'));
  assert.equal(saved.status, 'incomplete');
});
