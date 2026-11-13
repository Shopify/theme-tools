# theme-check-rs

## 0.1.1

### Patch Changes

- 5c726064: Add `Checker::cancelable`, for a run that stops between files, and `Error::is_cancelled`
- 4a04763c: Add `Checker::ignore`, the files a run leaves out, as in `.theme-check.yml`'s `ignore`
- d1d509d5: Add `Checker::threads`, where 1 checks the files on the calling thread, and resume a check's panic with its own message
