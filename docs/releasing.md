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
Before doing this flow, please ensure you are on the `main` branch and have no untracked changes present locally.

    ```bash
    yarn release
    ```


<!-- 
2. Push and merge your changes.

3. On [Shipit](https://shipit.shopify.io/shopify/theme-tools), deploy your commit.

4. [Create a GitHub release](https://github.com/Shopify/theme-tools/releases/new) for the change.

   ```
   version="vX.X.X"
   git fetch origin
   git fetch origin --tags
   git reset origin $version
   gh release create -t $version
   ```

   (It's a good idea to copy parts of the CHANGELOG in there) -->

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