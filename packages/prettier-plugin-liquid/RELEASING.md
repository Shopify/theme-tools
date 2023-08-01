## Releasing `@shopify/prettier-plugin-liquid`

1. Check the Semantic Versioning page for info on how to version the new release: http://semver.org

2. Run the following command to update the version in `package.json` and replace the `VERSION` placeholder in the documentation for new configuration variables:

   ```bash
   export VERSION="X.X.X"
   yarn prerelease
   ```

3. Run [`git changelog`](https://github.com/tj/git-extras) to update `CHANGELOG.md`.

   ```bash
   git changelog
   ```

5. Commit your changes and make a PR.

   ```bash
   git checkout -b "bump/v$VERSION"
   git add CHANGELOG.md package.json src/index.ts playground/index.html
   git commit -m "Bump version to $VERSION"
   git push origin "bump/v$VERSION"
   gh pr create --base="main" --head="Shopify:bump/v$VERSION"
   ```

6. Merge your PR to main.

7. Push the tag

   ```bash
   git tag v$VERSION
   git push origin v$VERSION
   ```

8. On [Shipit](https://shipit.shopify.io/shopify/prettier-plugin-liquid), deploy your commit.

9. [Create a GitHub release](https://github.com/Shopify/prettier-plugin-liquid/releases/new) for the change.

   ```
   git fetch origin
   git fetch origin --tags
   git reset origin v$VERSION
   gh release create -t v$VERSION
   ```

   (It's a good idea to copy parts of the CHANGELOG in there)
