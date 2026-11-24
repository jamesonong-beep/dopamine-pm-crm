# DOPAMINE — Projects & CRM (`CLAUDE.md`)

Follow `AGENTS.md` in this repository. Both **Claude** and **ChatGPT/Codex** share the same session commands below.

## Session Commands

### When the user says **"start session"**
1. Check `git status -sb` and `git branch --show-current`.
2. If the working tree is clean, run `git pull --ff-only`. If there are uncommitted local changes, pause and ask the user whether to stash, commit, or keep them before pulling.
3. Read `HANDOFF.md` (if present) and check `git log -n 5 --oneline`.
4. Give a short summary of:
   - Current branch and whether the pull succeeded
   - What was completed last session
   - Any open issues or next steps

### When the user says **"end session"**
1. Check `git status -sb` and `git diff --stat`.
2. Run verification checks before committing:
   ```bash
   npx tsc --noEmit && node tests/workspace-api.mjs && npm run build
   ```
   If any check fails, fix or report it before pushing.
3. Update `HANDOFF.md` in the repo root with the date, branch, what changed, test results, and next steps.
4. Stage changes (`git add -A`), making sure `node_modules/`, `.next/`, `.wrangler/`, `dist/`, `tsconfig.tsbuildinfo`, and `.env*`/credentials are never committed.
5. Commit with a clear message and run `git push`.

## Project Conventions
- **Stack:** Next.js / Vinext (Vite 8) + Cloudflare Workers / D1 (`wrangler`).
- **Themes:** Always keep both **Cubist Prism** (default) and **Warm Terracotta** clean.
- **Safety:** Never force-push (`git push --force`) or discard uncommitted work without asking first.
