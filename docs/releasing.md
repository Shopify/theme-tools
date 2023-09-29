# Releasing

## Adding changesets

1. Add a changeset. This will prompt you for additional information.

   ```bash
   yarn changeset add
   ```

2. Commit the changeset as part of your PR.

   ```bash
   git add .changeset/
   git commit -m 'Add changeset for my changes'
   ```

## Releasing new package versions

1. Start on main.

   ```bash
   git fetch origin main
   git checkout main
   git reset --hard origin/main
   ```

2. Run the release script.

   ```sh
   yarn release
   ```

3. Create a PR as per script says.
4. Merge said PR.
5. Run the [release GitHub workflow](https://github.com/Shopify/theme-tools/actions/workflows/release.yml) (requires manual dispatch).
6. Done!

## Release Orchestrator FAQ
### What does this project do?
This does the following tasks:
- compiles all the changeset that live in the `.changeset` folder
- patch bumps all packages where a mono-repo dependency has been bumped
- update the package versions accordingly and generates the changelog
- commits the changes (after user confirmation)
- creates a release PR

### What is the point of the release orchestrator?
This project exists to streamline the release process so that it is consistent and reliable every time it's run. We believe that the release process should be as much of a "one click solution" as possible and this helps us achieve that.

### Why does the release orchestrator enforce starting on the `main` branch with no existing repo changes?
Removes the risk of accidentally sneaking expected changes into a release without proper vetting through normal PR practices.

### Why does the release orchestrator create a new release branch during its process?
This establishes a convention for our release branch names. Additionally this enables us to build CI workflows targeting this branch name pattern to ensure that the release process can be as streamlined as possible while minimizing the window for error.

### Is the release orchestrator a publically available package?
No, while this package sits within the `packages/` directory of the `theme-tools` repo, this package is intended to be a purely internal tool. We put it within this directory to leverage our existing tsconfig patterns without needing to add additional configuration solely for an internal tool.

### What is the point of composing a release pipeline with flow?
The use of pure functions to compose a release pipeline here helps make sure that we can develop this complex flow in a simple and maintainable way. Each step of the pipeline can be enabled or disabled to do isolated tophatting. Additionally because each step is written as pure functions, this helps make unit testing easier.

### Does this release strategy violate semantic versioning(semver)?
We can understand how some might think that but we disagree. In semantic versioning, when a package releases a minor update, all packages that depend on it should update their dependency range to include the new version, but they do not bump their own version unless they have changes of their own. 

By that ommission, one might think we should not update these internal dependencies. Our counter point to this is that there's no other way for these internal dependencies packages to get access to potentially important changes upstream. 

#### Consider the example:

A react app uses `@shopify/theme-language-server-browser` to drive theme-check on a web page.
We add 3 new checks to `@shopify/theme-check-common` but add no breaking changes. This would be a minor version bump.

If we don't patch bump `@shopify/theme-language-server-browser`, then the react app would never get any of the new checks until we end up updating `@shopify/theme-language-server-browser` for unrelated reasons. We split out the different components of theme-check into separate packages for reusability but when it is used by a dependant package, we consider it as part of the functionality of that dependant package.

Our takeaway from this real usecase is that it is necessary to apply these patch version bumps in order to deliver updates consistently to end developers who depend on them.

### Why don't just you use `@changesets/cli`'s `updateInternalDependencies` config option to manage patch version bumps?
For context, this refers to [the library's documented config option](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md#updateinternaldependencies).

At the time of writing this doc; the end of that documentation states: `this is only applied for packages which are already released in the current release. If A depends on B and we only release B then A won't be bumped.`

This affects an important case for us: Nested monorail dependencies relying on each other. Consider this actual relationship within the theme-tools repo:
`@shopify/theme-language-server-node` depends on `@shopify/theme-language-server-common` which depends on `@shopify/theme-check-common`.

Please note we [already have `@changesets/cli` configured with `updateinternaldependencies: patch`](../.changeset/config.json) for its ability to patch bump internal dependencies once they are already in the release.

When we perform a release where there is an update to the minor version of `@shopify/theme-check-common`, but no update to `@shopify/theme-language-server-common`, then `changesets version`(the main command we use to apply a version bump) will not change `@shopify/theme-language-server-common` or `@shopify/theme-language-server-node`. So effectively we would have needed to manually bump those two packages within our monorepo before they could have access to the updates in `@shopify/theme-check-common`. Its high context, boring and repetitive dependency management work that's easy to miss which could result in outdated logic running under our noses. The `release-orchestrator` package enables us to automatically resolve any nested internal dependencies within the monorepo so that we don't need to worry about it.

Should `@changesets/cli` ever consider changing `updateinternaldependencies: patch`to apply to all packages outside of the current release, we may scrap this package.
