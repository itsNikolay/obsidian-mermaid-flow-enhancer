import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

type ToolName = 'actionlint' | 'shellcheck';
const root = fileURLToPath(new URL('../', import.meta.url));
const platform = `${process.platform}-${process.arch}`;
const checksums: Record<ToolName, Record<string, string>> = {
  actionlint: {
    'darwin-x64': '17ffc17fed8f0258ef6ad4aed932d3272464c7ef7d64e1cb0d65aa97c9752107',
    'darwin-arm64': 'a21ba7366d8329e7223faee0ed69eb13da27fe8acabb356bb7eb0b7f1e1cb6d8',
    'linux-x64': '900919a84f2229bac68ca9cd4103ea297abc35e9689ebb842c6e34a3d1b01b0a',
    'linux-arm64': '21bc0dfb57a913fe175298c2a9e906ee630f747cb66d0a934d0d4b69f4ee1235',
  },
  shellcheck: {
    'darwin-x64': 'c2c15e08df0e8fbc374c335b230a7ee958c313fa5714817a59aa59f1aa594f51',
    'darwin-arm64': '339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f',
    'linux-x64': 'b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6',
    'linux-arm64': '68a8133197a50beb8803f8d42f9908d1af1c5540d4bb05fdfca8c1fa47decefc',
  },
};
const definitions = {
  actionlint: { version: '1.7.11', repository: 'rhysd/actionlint',
    archive: `actionlint_1.7.11_${process.platform}_${process.arch === 'x64' ? 'amd64' : 'arm64'}.tar.gz`, entry: 'actionlint' },
  shellcheck: { version: '0.11.0', repository: 'koalaman/shellcheck',
    archive: `shellcheck-v0.11.0.${process.platform}.${process.arch === 'x64' ? 'x86_64' : 'aarch64'}.tar.gz`, entry: 'shellcheck-v0.11.0/shellcheck' },
};
function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}
async function install(name: ToolName) {
  const definition = definitions[name];
  const checksum = checksums[name][platform];
  if (!checksum) throw new Error(`Unsupported lint platform ${platform}; use npm run docker:check.`);
  const directory = join(root, 'node_modules/.cache/lint-tools', `${name}-${definition.version}`, platform);
  const binary = join(directory, definition.entry);
  if (existsSync(binary)) return binary;
  mkdirSync(directory, { recursive: true });
  const archive = join(directory, definition.archive);
  if (!existsSync(archive)) {
    const response = await fetch(`https://github.com/${definition.repository}/releases/download/v${definition.version}/${definition.archive}`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Download ${name}: HTTP ${response.status}`);
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== checksum) {
    throw new Error(`SHA-256 mismatch for ${name}; remove ${archive} and retry.`);
  }
  run('tar', ['-xzf', archive, '-C', directory, definition.entry]);
  chmodSync(binary, 0o755);
  return binary;
}
const mode = process.argv[2];
if (!['install', 'workflows', 'shell'].includes(mode ?? '')) throw new Error('Expected install, workflows, or shell.');
if (mode === 'shell') run(await install('shellcheck'), ['--shell=bash', 'docker/entrypoint.sh']);
else {
  const shellcheck = await install('shellcheck');
  const actionlint = await install('actionlint');
  if (mode === 'workflows') run(actionlint, ['-shellcheck', shellcheck, ...readdirSync(join(root, '.github/workflows')).filter(name => /\.ya?ml$/.test(name)).map(name => `.github/workflows/${name}`)]);
}
