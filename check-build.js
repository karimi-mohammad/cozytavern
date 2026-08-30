/**
 * Smart build checker — compares source file mtimes against dist output.
 * Returns { server: boolean, client: boolean } indicating what needs rebuilding.
 *
 * Usage:
 *   node check-build.js          — prints status and exits
 *   node check-build.js --json   — outputs JSON for scripts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFiles(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
        walk(full);
      } else if (exts.some(ext => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

function computeSourceHash(files) {
  const hash = crypto.createHash('md5');
  // Sort for deterministic ordering
  files.sort();
  for (const f of files) {
    const stat = fs.statSync(f);
    // Include mtime + size — fast, no file reads
    hash.update(`${f}:${stat.mtimeMs}:${stat.size}`);
  }
  return hash.digest('hex');
}

function getLatestMtime(dir, exts) {
  const files = getFiles(dir, exts);
  let latest = 0;
  for (const f of files) {
    const m = fs.statSync(f).mtimeMs;
    if (m > latest) latest = m;
  }
  return { latest, count: files.length };
}

function getDistMtime(dir) {
  const distDir = path.join(dir, 'dist');
  if (!fs.existsSync(distDir)) return 0;

  let latest = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const m = fs.statSync(full).mtimeMs;
        if (m > latest) latest = m;
      }
    }
  };
  walk(distDir);
  return latest;
}

function formatTime(ms) {
  if (ms === 0) return 'never';
  return new Date(ms).toLocaleString();
}

function formatAge(ms) {
  if (ms === 0) return 'never built';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function check(name, srcDir, exts) {
  const distMtime = getDistMtime(srcDir);
  const { latest: srcMtime, count } = getLatestMtime(srcDir, exts);
  const needsBuild = srcMtime > distMtime || distMtime === 0;

  return { name, srcMtime, distMtime, count, needsBuild };
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const results = {};

  // Server: .ts files in src/
  const server = check('server', path.join(ROOT, 'server'), ['.ts', '.json']);
  results.server = server.needsBuild;

  // Client: .tsx/.ts/.css files in src/
  const client = check('client', path.join(ROOT, 'client'), ['.tsx', '.ts', '.css', '.json']);
  results.client = client.needsBuild;

  if (jsonMode) {
    console.log(JSON.stringify(results));
    return;
  }

  // Pretty output
  console.log('');
  console.log('Build Status:');
  console.log('─'.repeat(50));

  for (const r of [server, client]) {
    const status = r.needsBuild ? 'NEEDS BUILD' : 'UP TO DATE';
    const icon = r.needsBuild ? '⚠' : '✓';
    console.log(`  ${icon} ${r.name.padEnd(8)} ${status}`);
    console.log(`    Source: ${r.count} files, latest: ${formatAge(r.srcMtime)}`);
    console.log(`    Dist:   ${formatAge(r.distMtime)}`);
  }

  console.log('─'.repeat(50));
  const anyNeed = server.needsBuild || client.needsBuild;
  console.log(anyNeed
    ? '  → Run "npm run build" to rebuild outdated parts.'
    : '  → Everything is up to date. No rebuild needed.');
  console.log('');
}

main();
