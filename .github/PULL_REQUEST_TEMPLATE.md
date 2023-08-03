# What are you adding in this PR?

<!-- Describe your changes. Provide enough context so that someone new can understand the 'why' behind this change. -->
<!-- Remember to use `fixes` or `solves` keywords to close issues automatically (https://help.github.com/articles/closing-issues-using-keywords/). -->

## What's next? Any followup issues?

<!-- Outline follow up tasks with links to issues so they're tracked. -->

## Before you deploy

<!-- If a checklist is not applicable, you can delete it. -->

<!-- Include this check when updating anything within packages/theme-check-* -->
- [ ] This PR includes a new checks
  - [ ] I included a minor bump `changeset`
  - [ ] It's in the `allChecks` array in `src/checks/index.ts`
  - [ ] I ran `yarn update-configs` and committed the updated configuration files
    <!-- It might be that a check doesn't make sense in a theme-app-extension context -->
    <!-- When that happens, the check's config should be updated/overridden in the theme-app-extension config -->
    <!-- see packages/node/configs/theme-app-extension.yml -->
    - [ ] If applicable, I've updated the `theme-app-extension.yml` config

- [ ] This PR changes the public API
  - [ ] I included a minor bump `changeset` titled `Breaking: ...`

- [ ] This PR fixes a bug
  - [ ] I included a patch bump `changeset` to this PR
