---
'theme-check-vscode': minor
---

Surface orphaned (dead) files on startup with a notification

When a theme has orphaned files, the VS Code extension now shows a single dismissable notification on startup with **Review** (opens the existing dead-code picker) and **Don't show again** actions, instead of requiring the user to run the dead-code command manually. Gated by the new `themeCheck.checkOrphanedFilesOnBoot` setting (default `true`).
