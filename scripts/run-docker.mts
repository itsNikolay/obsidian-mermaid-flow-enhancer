import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
const mode = process.argv[2] || 'check';
if (!['check', 'record'].includes(mode)) throw new Error('Expected check or record');
// An Obsidian update file runs on the image's installer, as an early-access build would.
const update = process.env.OBSIDIAN_ASAR ? resolve(process.env.OBSIDIAN_ASAR) : undefined;
const updateName = update ? basename(update) : undefined;
if (updateName && !/^obsidian-\d+\.\d+\.\d+\.asar$/.test(updateName)) throw new Error('OBSIDIAN_ASAR must name an obsidian-x.y.z.asar file');
const out = resolve('artifacts/docker', updateName ? updateName.replace(/\.asar$/, '') : '');
mkdirSync(out, { recursive: true });
const run = (args: string[]) => {
  const result = spawnSync('docker', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(['build', '-f', 'docker/Dockerfile', '-t', 'mermaid-flow-enhancer-test', '.']);
run(['run', '--rm', '--shm-size=1g', '--network=none', '--mount', `type=bind,source=${out},target=/artifacts`,
  ...(update ? ['--mount', `type=bind,source=${update},target=/obsidian-update/${updateName},readonly`,
    '--env', `OBSIDIAN_ASAR=/obsidian-update/${updateName}`] : []),
  'mermaid-flow-enhancer-test', 'bash', 'docker/entrypoint.sh', mode]);
