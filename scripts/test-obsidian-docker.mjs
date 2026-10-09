import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
if (process.env.MFE_DOCKER !== '1') throw new Error('Run this through npm run docker:check or docker:record. Host Obsidian is never launched.');
const record = process.argv[2] === 'record';
const vault = '/tmp/mfe-vault', profile = join(homedir(), '.config', 'obsidian'), out = '/artifacts';
await mkdir(`${vault}/.obsidian/plugins/mermaid-flow-enhancer`, { recursive: true });
await mkdir(profile, { recursive: true });
await mkdir(out, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css'])
  await copyFile(file, `${vault}/.obsidian/plugins/mermaid-flow-enhancer/${file}`);
await writeFile(`${vault}/.obsidian/community-plugins.json`, JSON.stringify(['mermaid-flow-enhancer']));
await writeFile(`${vault}/.obsidian/app.json`, JSON.stringify({ safeMode: false, livePreview: false, readableLineLength: false, showInlineTitle: false }));
await writeFile(`${profile}/obsidian.json`, JSON.stringify({ vaults: { demo: { path: vault, ts: Date.now(), open: true } } }));
await writeFile(`${vault}/Demo.md`, `# Mermaid Flow Enhancer\n\nSynthetic Docker demonstration — no personal notes.\n\n\`\`\`mermaid\nflowchart LR\nrequest[Request] --> triage[Triage]\ntriage --> ready{Ready to build?}\nready -->|No| clarify[Clarify details]\nclarify --> triage\nready -->|Yes| build[Build change]\nbuild --> checks{Checks pass?}\nchecks -->|No| build\nchecks -->|Yes| release[Release]\nrelease --> done((Complete))\n\`\`\`\n`);
const errors = [];
let app, browser, page, recorder, recorderDone, failure;
let recorderLog = "";
try {
  app = spawn(process.env.OBSIDIAN_EXECUTABLE, ['--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=9222', `--user-data-dir=${profile}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  let appLog = '';
  app.stderr.on('data', chunk => { appLog = (appLog + chunk).slice(-8000); });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (app.exitCode !== null) throw new Error(`Obsidian exited ${app.exitCode}: ${appLog}`);
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 1000 }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!browser) throw new Error(`Cannot connect to Obsidian: ${appLog}`);
  const context = browser.contexts()[0];
  page = context.pages()[0] || await context.waitForEvent('page');
  const trust = page.getByRole('button', { name: 'Trust author and enable plugins', exact: true });
  await trust.waitFor({ timeout: 15000 });
  let windowId;
  for (let attempt = 0; attempt < 30; attempt++) {
    const windows = spawnSync('xdotool', ['search', '--onlyvisible', '--class', 'obsidian'], { encoding: 'utf8' });
    windowId = windows.stdout.trim().split('\n')[0];
    if (windowId) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(windowId, 'Cannot find Obsidian X11 window');
  for (const args of [['windowsize', windowId, '1440', '1000'], ['windowmove', windowId, '0', '0']])
    assert.equal(spawnSync('xdotool', args).status, 0, 'Cannot size Obsidian window');
  await trust.click();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => globalThis.app?.vault?.getName() === 'mfe-vault', null, { timeout: 60000 });
  await page.evaluate(async () => {
    await app.plugins.enablePluginAndSave('mermaid-flow-enhancer');
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath('Demo.md'));
    await leaf.setViewState({ type: 'markdown', state: { file: 'Demo.md', mode: 'preview' } });
  });
  await page.getByRole('button', { name: 'Allow', exact: true }).click({ timeout: 15000 });
  await page.evaluate(() => {
    if (!document.querySelector('.workspace-split.mod-left-split')?.classList.contains('is-sidedock-collapsed'))
      app.commands.executeCommandById('app:toggle-left-sidebar');
  });
  // CDP screenshots omit native popups; bring the main X11 window above them.
  await page.bringToFront();
  spawnSync('xdotool', ['windowraise', windowId]);
  spawnSync('xdotool', ['windowfocus', windowId]);
  const svg = page.locator('svg.mfe-enhanced');
  await svg.waitFor({ timeout: 30000 });
  assert.equal(await svg.locator('.node').count(), 8);
  const geometry = await svg.evaluate(svg => {
    const nodes = new Map([...svg.querySelectorAll('.node[data-mpe-key]')].map(n =>
      [n.dataset.mpeKey, n.querySelector('rect,polygon,circle,ellipse').getBoundingClientRect()]));
    const errors = [...svg.querySelectorAll('path.flowchart-link[data-mpe-from]')].flatMap(path => {
      const point = length => path.getPointAtLength(length).matrixTransform(path.getScreenCTM());
      const distance = (p, r) => Math.min(
        Math.hypot(p.x-r.left, p.y-(r.top+r.height/2)),
        Math.hypot(p.x-r.right, p.y-(r.top+r.height/2)),
        Math.hypot(p.x-(r.left+r.width/2), p.y-r.top),
        Math.hypot(p.x-(r.left+r.width/2), p.y-r.bottom));
      return [distance(point(0), nodes.get(path.dataset.mpeFrom)),
        distance(point(path.getTotalLength()), nodes.get(path.dataset.mpeTo))];
    });
    return { endpoints: errors.length, maxError: Math.max(...errors) };
  });
  assert.equal(geometry.endpoints, 18);
  assert.ok(geometry.maxError < 0.01, JSON.stringify(geometry));

  if (record) {
    recorder = spawn('ffmpeg', ['-y', '-f', 'x11grab', '-video_size', '1440x1000', '-framerate', '30',
      '-i', ':99', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', `${out}/obsidian-demo.mp4`], { stdio: ['pipe', 'ignore', 'pipe'] });
    recorder.stderr.on('data', chunk => { recorderLog = (recorderLog + chunk).slice(-8000); });
    recorderDone = new Promise(resolve => {
      recorder.once('error', error => resolve({ error }));
      recorder.once('exit', code => resolve({ code }));
    });
  }
  const palettes = [];
  for (const theme of ['moonstone', 'obsidian']) {
    const dark = theme === 'obsidian';
    await page.evaluate(dark => {
      if (document.body.classList.contains('theme-dark') !== dark)
        app.commands.executeCommandById('theme:toggle-light-dark');
    }, dark);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => document.body.classList.contains('theme-dark')), dark);
    const palette = await svg.locator('.node rect').first().evaluate(el => ({ fill: getComputedStyle(el).fill }));
    palettes.push({ theme: dark ? 'dark' : 'light', ...palette });
    await page.screenshot({ path: `${out}/obsidian-${dark ? 'dark' : 'light'}.png` });
    const request = svg.locator('.node[data-mpe-key="request"]');
    const release = svg.locator('.node[data-mpe-key="release"]');
    await release.hover();
    await page.waitForTimeout(900);
    assert.match(await request.getAttribute('class'), /mpe-on-path/);
    assert.equal(await svg.evaluate(el => el.classList.contains('mpe-tracing')), true);
    for (const key of ['request', 'triage', 'ready', 'build', 'checks', 'release', 'done']) {
      const node = svg.locator(`.node[data-mpe-key="${key}"]`);
      const point = await node.evaluate(el => { const r = el.getBoundingClientRect(); return [Math.round(r.x+r.width/2), Math.round(r.y+r.height/2)]; });
      assert.equal(spawnSync('xdotool', ['mousemove', '--sync', ...point.map(String)]).status, 0);
      await node.hover();
      await page.waitForTimeout(650);
    }
    await page.mouse.move(1400, 950);
    await page.waitForTimeout(800);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(`${out}/report.json`, JSON.stringify({ obsidian: process.env.OBSIDIAN_VERSION,
    plugin: JSON.parse(await readFile('manifest.json', 'utf8')).version, realApp: true,
    desktop: 'Docker Xvfb', recording: record, nodes: 8, geometry, palettes, errors }, null, 2));
  console.log('Real Obsidian Docker smoke check passed');
} catch (error) {
  if (page) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  failure = error;
} finally {
  if (recorder) {
    if (recorder.exitCode === null && !recorder.killed) recorder.stdin.end('q');
    let timer;
    const outcome = await Promise.race([recorderDone, new Promise(resolve => { timer = setTimeout(() => { recorder.kill('SIGKILL'); resolve({ error: new Error('ffmpeg shutdown timed out') }); }, 15000); })]);
    clearTimeout(timer);
    if (outcome.error || outcome.code !== 0) failure ??= new Error(`ffmpeg recording failed: ${outcome.error || outcome.code}\n${recorderLog}`);
  }
  if (browser) await browser.close().catch(error => { failure ??= error; });
  if (app && app.exitCode === null) app.kill('SIGTERM');
}

if (failure) throw failure;

if (record) {
  const result = spawnSync('ffmpeg', ['-y', '-i', `${out}/obsidian-demo.mp4`, '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0', `${out}/obsidian-demo.gif`], { stdio: 'inherit' });
  assert.equal(result.status, 0, 'GIF encoding failed');
}
