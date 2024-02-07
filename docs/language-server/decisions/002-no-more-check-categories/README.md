# No more support for check categories

## Status

Accepted June 2023

## tl;dr

As part of the migration, we're removing support for the `include_categories` and `exclude_categories` configuration options.

## Context

Theme Check Ruby checks had a `categories` array. Some were flagged as `performance`, others as `style`, etc.

I don't think this provides enough value vs the context cost it requires. This version of theme-check is ESLint-inspired (as opposed to Theme Check Ruby which was Rubocop-inspired), and I don't think the value provided is worth the extra noise on the CLI's `--help`, nor would it be worth the extra work to make this work.

We may change our mind in the future, but I think it's safe to simply ignore those configurations and move on for a tighter, simpler API.

## Consequences

Folks that want to only run performance checks might have to write a subset of the config that only enables performance-related checks. e.g. making a `performance.yml` file.

Given how the new framework allows us to extend multiple configurations, I think this might be a better approach than adding a required `categories` property to the `CheckDefinition` of all checks.
