const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const cwd = process.cwd();
const candidates = ['.env.production', '.env.local', '.env'];

for (const fileName of candidates) {
  const envFile = path.join(cwd, fileName);
  if (!fs.existsSync(envFile)) continue;

  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const args = ['node_modules/next/dist/bin/next', 'start', '-p', process.env.PORT || '3200'];
const child = spawn(process.execPath, args, {
  cwd,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});
