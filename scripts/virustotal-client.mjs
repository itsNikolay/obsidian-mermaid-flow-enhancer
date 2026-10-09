const base = 'https://www.virustotal.com/api/v3';
const countFields = ['malicious', 'suspicious', 'undetected', 'harmless'];

export function verdict(attributes) {
  if (!attributes || !['queued', 'in-progress', 'completed'].includes(attributes.status))
    throw new Error('VirusTotal returned an invalid analysis status');
  if (attributes.status !== 'completed') return { status: 'pending' };
  const stats = attributes.stats;
  if (!stats || countFields.some(key => !Number.isSafeInteger(stats[key]) || stats[key] < 0)
      || Object.values(stats).some(value => !Number.isSafeInteger(value) || value < 0))
    throw new Error('VirusTotal returned invalid or incomplete engine counts');
  const detected = stats.malicious + stats.suspicious;
  const analyzed = detected + stats.harmless + stats.undetected;
  if (!analyzed) throw new Error('VirusTotal completed without an engine verdict');
  return { status: detected ? 'flagged' : 'no-detections', detected, analyzed };
}

export function createClient({ apiKey, fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now,
  intervalMs = 16000, maxAttempts = 4 } = {}) {
  if (!apiKey?.trim()) throw new Error('VIRUSTOTAL_API_KEY is required; configure a GitHub Actions secret');
  let lastRequest = -Infinity;
  return {
    async request(path, { method = 'GET', body } = {}) {
      if (!/^\/(files|analyses)(\/[^?#]+)?$/.test(path)) throw new Error('Invalid VirusTotal API path');
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(Math.max(0, intervalMs - (now() - lastRequest)));
        lastRequest = now();
        let response;
        try {
          response = await fetchImpl(base + path, { method, body,
            headers: { 'x-apikey': apiKey.trim() }, redirect: 'error', signal: AbortSignal.timeout(30000) });
        } catch { throw new Error('VirusTotal request failed or timed out'); }
        if (response.ok) {
          try { return await response.json(); }
          catch { throw new Error('VirusTotal returned invalid JSON'); }
        }
        if ((response.status === 429 || response.status >= 500) && attempt + 1 < maxAttempts) {
          // Respect the public API quota; do not print server responses or the API key.
          const retryAfter = Number(response.headers?.get('retry-after'));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60000 * (attempt + 1);
          await sleep(Math.min(180000, Math.max(16000, backoff)));
          continue;
        }
        throw new Error(`VirusTotal API failed (HTTP ${response.status}); scan not verified`);
      }
      throw new Error('VirusTotal API retry limit exceeded');
    }
  };
}
