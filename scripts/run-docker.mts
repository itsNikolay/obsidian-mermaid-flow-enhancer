import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const mode = process.argv[2] || 'check';
if (!['check', 'record'].includes(mode)) throw new Error('Expected check or record');
const out = resolve('artifacts/docker');
mkdirSync(out, { recursive: true });
const run = (args: string[]) => {
  const result = spawnSync('docker', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(['build', '-f', 'docker/Dockerfile', '-t', 'mermaid-flow-enhancer-test', '.']);
run(['run', '--rm', '--shm-size=1g', '--network=none', '--mount', `type=bind,source=${out},target=/artifacts`,
  'mermaid-flow-enhancer-test', 'bash', 'docker/entrypoint.sh', mode]);
