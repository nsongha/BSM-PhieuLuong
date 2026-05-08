#!/usr/bin/env node
/**
 * Release script: bump version → build → tạo GitHub Release
 * Dùng: npm run release [patch|minor|major]
 * Mặc định: patch
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dir, '../package.json');

// --- Helpers ---
function run(cmd, opts = {}) {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function bumpVersion(current, level) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// --- Main ---
const bumpLevel = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpLevel)) {
  console.error('❌ Dùng: npm run release [patch|minor|major]');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const newVersion = bumpVersion(oldVersion, bumpLevel);

console.log(`\n🚀 Release: v${oldVersion} → v${newVersion} (${bumpLevel})\n`);

// 1. Bump version trong package.json
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json: ${oldVersion} → ${newVersion}\n`);

// 2. Build
console.log('📦 Đang build...\n');
run('npm run build:win', { cwd: resolve(__dir, '..') });

// 3. Commit & tag
run(`git add phieu-luong-app/package.json`);
run(`git commit -m "chore: release v${newVersion}"`);
run(`git tag v${newVersion}`);
run(`git push && git push --tags`);

// 4. Tạo GitHub Release + upload artifacts
const releaseDir = resolve(__dir, '../release');
const exeFile = `${releaseDir}/Phieu Luong Setup ${newVersion}.exe`;
const latestYml = `${releaseDir}/latest.yml`;

console.log('\n📤 Tạo GitHub Release...\n');
run(
  `gh release create v${newVersion} "${exeFile}" "${latestYml}" ` +
  `--title "v${newVersion}" ` +
  `--notes "## Phiếu Lương v${newVersion}\n\nXem CHANGELOG.md để biết thay đổi."`
);

console.log(`\n✅ Xong! Phiên bản v${newVersion} đã được publish.`);
console.log(`👉 https://github.com/nsongha/BSM-PhieuLuong/releases/tag/v${newVersion}\n`);
