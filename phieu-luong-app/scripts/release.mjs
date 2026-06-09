#!/usr/bin/env node
/**
 * ⚠️  DEPRECATED — Đừng dùng script này từ v0.3.1 trở đi.
 *
 * Cách release đúng (xem `docs/developer-guide.md` §7):
 *   1. Bump version trong package.json + VERSION + CHANGELOG, merge vào main qua PR.
 *   2. `git checkout main && git pull --ff-only`
 *   3. `git tag -a vX.Y.Z -m "..."`
 *   4. `git push origin vX.Y.Z`
 *   5. CI (`.github/workflows/build.yml`) tự build .dmg + .exe + tạo GitHub Release.
 *
 * Lý do deprecated:
 *   - Tự bump version từ package.json hiện tại → nếu đã bump qua PR sẽ bump lần nữa
 *   - `npm run build:win` trong script này FAIL trên Apple Silicon Mac (electron-builder
 *     cần wine + Rosetta để chạy rcedit.exe; cached wine binary là Intel x86_64)
 *   - Chỉ build Windows, không build Mac → Mac users không nhận auto-update
 *
 * Chỉ dùng script này nếu bạn đang chạy từ Windows + CI không khả dụng.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Cảnh báo runtime ngay khi script khởi chạy
console.error('\n⚠️  WARNING: scripts/release.mjs is deprecated.');
console.error('   Use the CI tag-push flow instead — see docs/developer-guide.md §7.');
console.error('   Continue in 3s, or Ctrl+C to abort...\n');
await new Promise((r) => setTimeout(r, 3000));

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
