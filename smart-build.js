/**
 * Smart build — only rebuilds parts that have changed source files.
 * Uses mtimes to compare source vs dist. Skips unchanged parts.
 *
 * NOTE: Uses exec() for npm commands because .cmd files on Windows
 * require shell execution. Commands are hardcoded — no user input.
 *
 * Exit codes: 0 = success, 1 = build failed
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ── Mtime helpers ───────────────────────────────────────────────────

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

function needsBuild(srcDir, exts) {
  const distMtime = getDistMtime(srcDir);
  const { latest: srcMtime } = getLatestMtime(srcDir, exts);
  return srcMtime > distMtime || distMtime === 0;
}

// ── Build helpers ───────────────────────────────────────────────────

function buildPart(name, dir) {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log(`  Building ${name}...`);

    exec('npm run build', { cwd: dir }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (err) {
        console.error(`  ✗ ${name} build FAILED (${elapsed}s, exit code ${err.code})`);
        resolve(false);
      } else {
        console.log(`  ✓ ${name} built successfully (${elapsed}s)`);
        resolve(true);
      }
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const serverDir = path.join(ROOT, 'server');
  const clientDir = path.join(ROOT, 'client');

  const serverChanged = needsBuild(serverDir, ['.ts', '.json']);
  const clientChanged = needsBuild(clientDir, ['.tsx', '.ts', '.css', '.json']);

  if (!serverChanged && !clientChanged) {
    console.log('  ✓ Everything up to date — skipping build.');
    console.log('');
    return;
  }

  const parts = [];
  if (serverChanged) parts.push({ name: 'server', dir: serverDir });
  if (clientChanged) parts.push({ name: 'client', dir: clientDir });

  const totalStart = Date.now();
  let allOk = true;

  for (const p of parts) {
    if (!await buildPart(p.name, p.dir)) {
      allOk = false;
      break;
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  if (allOk) {
    console.log(`  All builds completed in ${totalElapsed}s`);
  } else {
    console.error(`  Build failed after ${totalElapsed}s`);
    process.exit(1);
  }
  console.log('');
}

main();
