# Session Handoff (`HANDOFF.md`)

- **Date:** 2026-11-25
- **Branch:** `main`
- **Last AI used:** Gemini

## What Changed
- Made all previously non-editable and partially editable cards editable across **DOPAMINE — Projects & CRM**, compatible with both **Cubist Prism** and **Warm Terracotta** themes:
  - **Newly editable:** Contacts (`contactEdit` in expanded Contacts rows and Company/Brand overviews), Companies (`companyEdit` in Table, Cards, and Overview drawer), Brands (`brandEdit` in Cards and Overview drawer), Suppliers (`supplierEdit`), and owner-only People (`personEdit`, cascading renamed owners across assigned records and keeping member sign-in emails in sync).
  - **Expanded editing:** Touchpoints (`touchpointEdit`, keeping linked follow-up task due dates synced), Waiting On (`waitingEdit`), Approvals (`approvalEdit`, enforcing document permissions), Meetings (`meetingEdit` on Calendar, Day Detail modal, and My Day), Projects (name, engagement, brand, client price, planned cost + **Edit project** button), Deals (name), and Tasks (name, dependency).
- Enforced server-side section, record-scope, financial, and document-access checks in `lib/access.ts` and `app/api/workspace/route.ts`, wired site-wide Undo and interactive preview support in `app/workspace.tsx`, and added API/permission tests in `tests/workspace-api.mjs`.

## Verification
- `npx tsc --noEmit`: Passed (0 errors)
- `node tests/workspace-api.mjs`: Passed (13 test suites, including full card editing and restricted-member `403` checks)
- `npm run build`: Passed (`vinext build`; route classification warning only)

## Next Steps / Open Issues
- Publish the updated `main` branch to the live pilot site when ready.
- Perform live two-account browser testing across all new Edit modals in both Cubist Prism and Warm Terracotta themes.
- Review `handoffs/GEMINI-REVIEW-PILOT-v2.md` for remaining Pilot v2 notes (`sharedWork` undo `expectedRevision` and cross-company meeting link validation).

## Repository Background
- Initialized from `DOPAMINE-Rev8-Shared-Pilot-v2-2026-11-24.zip`.
- `AGENTS.md` and `CLAUDE.md` define shared session workflows for Codex, Claude, and Gemini.
