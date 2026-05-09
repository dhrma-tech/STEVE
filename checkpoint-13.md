# checkpoint-13.md

## Phase
Execution Phase 12 - Files And Library.

## Status
Complete and verified.

## What Was Built
- Added `src/lib/files/data.ts` as the file-library service layer for folder reads/creation/update, file upload/list/detail/update, version creation, preview serialization, share visibility, and archive.
- Added file/folder API handlers:
  - `GET/POST /api/orgs/[orgId]/folders`
  - `PATCH /api/orgs/[orgId]/folders/[folderId]`
  - `GET/POST /api/orgs/[orgId]/files`
  - `GET/PATCH /api/orgs/[orgId]/files/[fileId]`
  - `POST /api/orgs/[orgId]/files/[fileId]/versions`
  - `POST /api/orgs/[orgId]/files/[fileId]/archive`
  - `GET /api/orgs/[orgId]/files/[fileId]/preview`
- Built reusable file UI components:
  - `FileLibrary`
  - `FolderTree`
  - `FileList`
  - `FileUploadDialog`
  - `FilePreviewPanel`
- Replaced the canvas Files tab static list with the full library browser.
- Preserved department file panels through existing `DepartmentSections` and verified that department-attached files appear there.
- Added `artifacts/phase12-files-smoke.cjs` for repeatable browser/API verification and `artifacts/phase12-files-library.png` screenshot output.
- Updated `REGISTRY.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md`, `SCRATCHPAD.md`, and `docs/api-spec.md`.

## Assumptions Made This Phase
- [ASSUMPTION-19] File binary storage provider and exact object-storage path are unspecified in the notes; Phase 12 uses logical storage keys and safe preview metadata in the existing frozen schema.
- [QUESTION-25] Live object storage, signed URL format, and document renderers need human/provider decisions in Phase 13 or later.

## Deviations From Plan
- Upload/version endpoints use local JSON payloads with optional safe preview text instead of multipart binary upload. This avoids inventing a storage provider or schema table after the Phase 1 schema freeze.
- Task attachment picker behavior remains the existing task `FileUpload` surface from Phase 9; Phase 12 adds library upload/versioning and keeps task attachments compatible with the file library.

## Decisions Added
- [ASSUMPTION-19] File binary storage provider/path unspecified; use existing `File.storageKey`, `FileVersion.storageKey`, and metadata previews.
- [DECISION-47] Use `orgs/{orgId}/files/...` logical storage keys for uploads and versions.
- [DECISION-48] Inline-preview text/markdown/JSON/CSV and show metadata previews for image/PDF/office/unknown files.

## Open Questions Raised
- [QUESTION-25] File upload/storage lacks specified binary object storage, signed URL shape, and document preview renderer.

## Verification Pass
| Required Item | Status | Notes |
|---|---|---|
| Folder tree | ✅ built | `FolderTree` renders All files, General, nested folders, and counts. |
| General folder created automatically | ✅ built | `getFileLibraryData` calls `ensureGeneralFolder`. |
| Business Plan appears in General folder | ✅ built | `getFileLibraryData` calls `ensureBusinessPlanFile`; browser smoke waits for `Business Plan.md`. |
| Upload files | ✅ built | `POST /files` plus `FileUploadDialog`; smoke creates markdown files through API. |
| Search | ✅ built | `q` filters file name/mime/folder/department/task; smoke verifies search finds the uploaded marker file. |
| Folder navigation | ✅ built | folder filtering in `FileLibrary` and folder creation API; smoke creates a nested folder. |
| Preview common file types | ✅ built | inline text/markdown/JSON/CSV, metadata previews for image/PDF/office/unknown. Smoke verifies markdown preview. |
| Share links/visibility | ✅ built | file visibility patch and share URL; smoke verifies `shared` state. |
| Archive | ✅ built | archive route sets `archivedAt`; smoke verifies archived payload. |
| Version history | ✅ built | first version ensured and new versions added; smoke verifies version history UI. |
| Business Plan saved after onboarding | ✅ built | existing onboarding save path preserved; library read retrofits first version. |
| Department files appear in department panels | ✅ built | smoke creates a department file and waits for it in department detail panel. |

## Verification Commands
- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm verify` ✅
- `pnpm build` ✅
- `node artifacts/phase12-files-smoke.cjs` ✅

## Next Phase Depends On
- Phase 13 can build settings, billing, and integrations on top of the existing file library, especially storage/provider configuration if object storage is added later by explicit migration/adapter work.
