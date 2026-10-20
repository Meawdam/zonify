import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const port of [3001, 4001]) {
  await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once('error', () => reject(new Error(`Port ${port} is in use. Stop the previous demo before starting again.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
const env = { ...process.env, ZONIFY_DEMO_MODE: '1', BACKEND_URL: 'http://127.0.0.1:4001' };
const backend = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/scripts/demo-server.ts'], { cwd: resolve(root, 'backend'), env, stdio: ['inherit', 'pipe', 'inherit'], windowsHide: true });
let frontend, stopping = false, started = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of [frontend, backend]) if (child?.pid) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 1200);
}
backend.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (!started && chunk.toString().includes('DEMO_READY')) {
    started = true;
    frontend = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3001'], { cwd: resolve(root, 'frontend'), env, stdio: 'inherit', windowsHide: true });
    frontend.on('exit', code => stop(code ?? 0)); frontend.on('error', error => { console.error(error); stop(1); });
    console.log('\nOpen http://127.0.0.1:3001/demo — Ctrl+C stops this demo. Restart starts fresh.');
  }
});
backend.on('exit', code => stop(code ?? 0)); backend.on('error', error => { console.error(error); stop(1); });
process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());
