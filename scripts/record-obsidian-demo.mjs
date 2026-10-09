// Legacy entry point: all real Obsidian captures now run in Docker.
// Never invoke the user's host Obsidian application or read a host vault.
console.log('Recording real Obsidian in Docker; artifacts: artifacts/docker/');
process.argv[2] = 'record';
await import('./run-docker.mjs');
