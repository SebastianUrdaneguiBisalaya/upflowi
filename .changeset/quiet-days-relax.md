---
"@upflowi/core": patch
---

Fix a race in the concurrency scheduler where a task's completion callback (and anything derived from it, such as `Uploader.active` or the `allCompleted` event) could observe the active-task count before it was decremented. `active`/`pending` and `allCompleted` now always reflect the finished task's slot being freed.
