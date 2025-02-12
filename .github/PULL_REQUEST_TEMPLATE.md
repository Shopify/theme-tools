## What are you adding in this PR?

<!-- Describe your changes. Provide enough context so that someone new can understand the 'why' behind this change. -->
<!-- Remember to use `fixes` or `solves` keywords to close issues automatically (https://help.github.com/articles/closing-issues-using-keywords/). -->

## What's next? Any followup issues?

<!-- Outline follow up tasks with links to issues so they're tracked. -->

## What did you learn?

<!-- Totally optional. But... If you learned something interesting, why not share it? -->

## Before you deploy

<!-- Delete the checklists you don't need -->

<!-- Check changes -->
- [ ] This PR includes a new checks or changes the configuration of a check
  - [ ] I included a minor bump `changeset`
  - [ ] It's in the `allChecks` array in `src/checks/index.ts`
  - [ ] I ran `yarn build` and committed the updated configuration files
    <!-- It might be that a check doesn't make sense in a theme-app-extension context -->
    <!-- When that happens, the check's config should be updated/overridden in the theme-app-extension config -->
    <!-- see packages/node/configs/theme-app-extension.yml -->
    - [ ] If applicable, I've updated the `theme-app-extension.yml` config
  - [ ] I've made a PR to update the [shopify.dev theme check docs](https://github.com/Shopify/shopify-dev/tree/main/content/storefronts/themes/tools/theme-check/checks) if applicable (link PR here).

<!-- Public API changes, new features -->
- [ ] I included a minor bump `changeset`
- [ ] My feature is backward compatible

<!-- Bug fixes -->
- [ ] I included a patch bump `changeset`
