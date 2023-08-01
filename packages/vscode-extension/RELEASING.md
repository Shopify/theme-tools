1.  Set the VERSION environment variable and make sure you're on the latest main.

    ```bash
    VERSION=X.X.X
    git checkout main
    git fetch origin main:main
    git reset --hard origin/main
    ```

2.  Update the CHANGELOG.

    ```bash
    # if you have git-extras installed
    git changelog -t $VERSION
    ```

1.  Update the package.json version to the newest version.

2.  Commit your changes and push your changes.

    ```bash
    git add .
    git commit -m "Bump to $VERSION"
    git push origin main
    git tag "v$VERSION"
    git push origin "v$VERSION"
    ```

3.  Install node deps + build extension + publish (assumes you have `vsce` globally installed - `yarn global add vsce`)

    ```bash
    vsce login Shopify
    scripts/check-yarn-links.sh && yarn && yarn build && yarn && yarn build && vsce publish $VERSION
    ```

4.  Make a GitHub release for the change.

    https://github.com/Shopify/theme-check-vscode/releases/new
