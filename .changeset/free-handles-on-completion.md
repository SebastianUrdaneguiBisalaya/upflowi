---
"@upflowi/core": patch
---

Fix `Uploader` retaining every upload handle forever: a completed, failed, or cancelled upload's internal handle is now freed once it settles. This closes a memory leak in long-lived `Uploader` instances (e.g. a singleton used across an app's lifetime) and allows a `fileId` to be reused once its previous upload has reached a terminal status — previously `add()` would throw `UploadValidationError` for a `fileId` that had already completed, not just one still active. `Uploader.size` is unaffected and still reflects the total number of files ever registered.
