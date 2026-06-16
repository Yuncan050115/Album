#!/usr/bin/env node
/**
 * Cross-platform Prisma launcher.
 *
 * Why this exists:
 * - Next.js apps often keep secrets in .env.local.
 * - Prisma CLI only auto-loads .env by default.
 * - Spawning npx.cmd can fail on some Windows/Node combinations.
 *
 * This script loads .env and .env.local, then starts Prisma through the
 * local CLI entry with the current Node executable instead of npx/npx.cmd.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseEnvValue(raw) {
  let value = raw.trim();

  if (!value) return '';

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filename, override = false) {
  const file = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(file)) return;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = parseEnvValue(trimmed.slice(eq + 1));

    if (override || !Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local', true);

const args = process.argv.slice(2);
let prismaCli;

try {
  prismaCli = require.resolve('prisma/build/index.js', {
    paths: [process.cwd()],
  });
} catch (error) {
  console.error('没有找到本地 Prisma CLI。请先执行 pnpm install。');
  console.error(error);
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCli, ...args], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
  windowsHide: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
