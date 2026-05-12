#!/usr/bin/env node
/**
 * Release script: bump version → build → tạo GitHub Release
 * Dùng: npm run release [patch|minor|major]
 * Mặc định: patch
 *
 * Quản lý 2 file version song song:
 *   - package.json  → semver 3-digit (0.1.0)   dùng cho electron-updater
 *   - VERSION       → 4-digit     (0.1.0.0)     dùng cho gstack-ship
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');          // phieu-luong-app/
const gitRoot = resolve(root, '..');        // PhieuLuong/ (git repo root)
const pkgPath = resolve(root, 'package.json');
const versionPath = resolve(root, 'VERSION');

function run(cmd, opts = {}) {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function bumpSemver(current, level) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// Đồng bộ VERSION file (4-digit) từ semver (3-digit)
function toFourDigit(semver) {
  return `${semver}.0`;
}

// --- Main ---
const bumpLevel = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpLevel)) {
  console.error('❌ Dùng: npm run release [patch|minor|major]');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const newVersion = bumpSemver(oldVersion, bumpLevel);
const newVersionFour = toFourDigit(newVersion);

console.log(`\n🚀 Release: v${oldVersion} → v${newVersion} (${bumpLevel})\n`);

// 1. Bump package.json
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json: ${oldVersion} → ${newVersion}`);

// 2. Sync VERSION file (giữ gstack-ship không tự override)
writeFileSync(versionPath, newVersionFour + '\n');
console.log(`✅ VERSION:      ${toFourDigit(oldVersion)} → ${newVersionFour}\n`);

// 3. Build
console.log('📦 Đang build...\n');
run('npm run build:win', { cwd: root });

// 4. Commit & tag (chạy từ git root)
const gitOpts = { cwd: gitRoot };
run(`git add phieu-luong-app/package.json phieu-luong-app/VERSION`, gitOpts);
run(`git commit -m "chore: release v${newVersion}"`, gitOpts);
run(`git tag v${newVersion}`, gitOpts);
run(`git push && git push --tags`, gitOpts);

// 5. Tạo GitHub Release + upload artifacts
const releaseDir = resolve(root, 'release');
// Tên file khớp với artifactName trong package.json: "phieu-luong-setup-${version}.exe"
const exeFile = `${releaseDir}/phieu-luong-setup-${newVersion}.exe`;
const latestYml = `${releaseDir}/latest.yml`;

console.log('\n📤 Tạo GitHub Release...\n');
run(
  `gh release create v${newVersion} "${exeFile}" "${latestYml}" ` +
  `--title "v${newVersion}" ` +
  `--notes "## Phiếu Lương v${newVersion}\n\nXem CHANGELOG.md để biết thay đổi."`
);

console.log(`\n✅ Xong! Phiên bản v${newVersion} đã được publish.`);
console.log(`👉 https://github.com/nsongha/BSM-PhieuLuong/releases/tag/v${newVersion}\n`);
