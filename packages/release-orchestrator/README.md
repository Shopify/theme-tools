# Release Orchestrator

## Description

This package is specifically designed to streamline the release process for the theme tools monorepo. Its sole purpose is to make the versioning process as effortless as possible, and it should not be referenced by other packages within this repository or published externally.

## Functionality

The package largely leverages the capabilities of `@changesets/cli` for driving the versioning process. To make the process more suited to the theme tools monorepo, it adds a layer of logical enhancements to perform version bumps in the most sensible way.

Please note that this package is solely intended for internal usage within this repository. It should not be referenced by any other packages in this repository nor should it be published as an external package.

## Usage

To use this package, please run `yarn release` from the repo root. Additionally please ensure that you are on the `main` branch and have no unstaged changes within your repo.

## Contributing

Contributions to improve the release process are welcomed. Please ensure your changes align with our contribution guidelines before submitting a pull request.

## License

This package is licensed under the same license as the theme tools monorepo. Please refer to the LICENSE file for more information.