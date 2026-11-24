# Session Handoff (`HANDOFF.md`)

- **Date:** 2026-11-24
- **Branch:** `work`
- **Last AI used:** Codex

## What Changed
- Added an App information card to Members & access settings, showing the application version from `package.json` and an optional short build ID from `NEXT_PUBLIC_APP_BUILD`.

## Verification
- `npx tsc --noEmit`: Passed
- `node tests/workspace-api.mjs`: Passed (12 groups)
- `npm run build`: Passed (`vinext build`; route classification warning only)

## Next Steps / Open Issues
- Review `handoffs/GEMINI-REVIEW-PILOT-v2.md` when available for Pilot v2 notes, including `sharedWork` undo `expectedRevision` and cross-company meeting link validation.
- Perform live two-account browser testing.
- App build ID is only shown when `NEXT_PUBLIC_APP_BUILD` is configured.

## Repository Background
- Initialized from `DOPAMINE-Rev8-Shared-Pilot-v2-2026-11-24.zip`.
- `AGENTS.md` and `CLAUDE.md` define shared session workflows for Codex, Claude, and Gemini.
