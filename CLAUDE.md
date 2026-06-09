## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

## Release flow — LUÔN dùng CI tag-push, đừng build local

Khi user yêu cầu "build và publish" / "ship release" / "HR nhận update":

1. **Bump version** trong `phieu-luong-app/package.json` (3-digit) + `phieu-luong-app/VERSION` (4-digit `x.y.z.0`) + add entry to `phieu-luong-app/CHANGELOG.md`. Merge bump vào `main` qua PR.

2. **Pull main**, tạo annotated tag, push tag:
   ```bash
   git checkout main && git pull --ff-only
   git tag -a v0.3.1 -m "Release v0.3.1: <summary>"
   git push origin v0.3.1
   ```

3. **CI tự lo phần còn lại** — `.github/workflows/build.yml` build .dmg (macos-latest runner) + .exe (windows-latest runner) + tạo GitHub Release với `latest.yml`/`latest-mac.yml`. End-user `electron-updater` poll mỗi 1 giờ → tự nhận update.

### KHÔNG được làm các việc sau

- ❌ **`npm run build:win` trên Mac** — `electron-builder --win` cần wine để chạy `rcedit.exe` (set EXE metadata). Cached wine ở `~/Library/Caches/electron-builder/wine/` là Intel x86_64 binary; Apple Silicon không chạy được nếu thiếu Rosetta. Build sẽ die với `cannot execute ... bad CPU type in executable`. **Luôn dùng CI runner Windows-latest thay vì cross-compile từ Mac.**
- ❌ **`npm run release`** (script `scripts/release.mjs`) — DEPRECATED. Script này: (a) tự bump version từ package.json hiện tại → nếu bạn đã bump rồi sẽ bump lần nữa, (b) chỉ build Windows, (c) chạy build local nên gặp lỗi wine ở trên.

### Nếu CI broken

Lịch sử: CI bị broken từ v0.2.3 (5/2026) đến v0.3.0 vì `electron-builder` cố auto-publish trong lúc build (cần `GH_TOKEN`). PR #9 đã fix bằng `--publish never` + thêm `*.yml`/`*.blockmap` vào upload list.

Nếu CI lại fail trong tương lai: đọc log via `gh run view <run-id> --log-failed`, sửa workflow, commit qua PR. Không bao giờ thử build:win local thay thế.

Xem chi tiết: `phieu-luong-app/docs/developer-guide.md` §7 Release.
