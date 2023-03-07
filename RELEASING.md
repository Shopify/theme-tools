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

## Releasing

1.  Update the version and changelog by running the changeset version command.

    ```bash
    yarn changeset version
    ```

    This compiles all the changeset that live in the `.changeset` folder, update the package versions accordingly and generates the changelog.

2.  Commit your changes.

    ```bash
    git add packages/*/package.json
    git add packages/*/CHANGELOG.md
    git commit
    ```

3. Push and merge your changes.

3. On [Shipit](https://shipit.shopify.io/shopify/theme-check-js), deploy your commit.

4. [Create a GitHub release](https://github.com/Shopify/theme-check-js/releases/new) for the change.

   ```
   VERSION=...
   git fetch origin
   git fetch origin --tags
   git reset origin v$VERSION
   gh release create -t v$VERSION
   ```

   (It's a good idea to copy parts of the CHANGELOG in there)
