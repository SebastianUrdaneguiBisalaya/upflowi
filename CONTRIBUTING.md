# Contributing

Thanks for your interest in contributing! This project is a Node.js SDK template written in TypeScript. Please read this guide before opening a pull request.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Be respectful and constructive — disagreements about code and design are welcome; personal attacks are not.

## Prerequisites

- Node.js `>=18.0.0`
- [pnpm](https://pnpm.io/) `12.3.4` (this repo uses pnpm exclusively — do not commit `package-lock.json` or `yarn.lock`)

## Getting started

1. **Fork** the repository and clone your fork:
   ```bash
   git clone git@github.com:<your-username>/<your-repo>.git
   cd <your-repo>
   ```
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. **Create a branch** from `main` using a descriptive, prefixed name:
   ```bash
   git switch -c feat/add-refunds-resource
   git switch -c fix/charges-error-mapping
   git switch -c docs/update-readme-examples
   ```
   Common prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`.

## Making changes

- Keep pull requests focused: one logical change per PR. Unrelated fixes should be separate PRs.
- Follow the standards documented in [`AGENTS.md`](./AGENTS.md) — this is the source of truth for architecture, TypeScript conventions, public API surface, and SDK-specific practices (client design, error handling, security). Read it before making non-trivial changes.
- Only export from `src/index.ts` what is meant to be public API. Adding or changing an export is a public API change — treat it accordingly (see semver rules in `AGENTS.md`).
- Never commit `dist/`, `.env*` files, real API credentials, or real sensitive data (including in test fixtures — use the third-party provider's documented test credentials/fixtures only).
- Write TSDoc comments on public functions/types when the name alone isn't self-explanatory.

## Git hooks

This repo uses [husky](https://typicode.github.io/husky/) to run checks automatically via git hooks. They install for you the first time you run `pnpm install`, so you don't need to set anything up manually:

- **`pre-commit`**: runs `pnpm run lint` and `pnpm run typecheck`.
- **`commit-msg`**: rejects commits whose message doesn't follow Conventional Commits (see below).
- **`pre-push`**: runs `pnpm run test` and `pnpm run build`.

Don't bypass these with `--no-verify` — if a hook is blocking you, fix the underlying issue (or ask in the PR/issue if you think the hook itself is wrong).

## Local checks (must pass before opening a PR)

Run these locally — the same checks run in CI on every pull request:

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # biome check
pnpm run test        # vitest run
pnpm run build       # tsup, verifies the package actually bundles
```

If you're adding new behavior, add or update tests under `tests/`, mirroring the structure of `src/`. Mock the HTTP layer — never call the real third-party API from unit tests.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(client): add support for automatic retries
fix(client): correctly propagate 401 responses as AuthenticationError
docs: add usage example to README
chore(deps): bump tsup to 8.6.0
```

This keeps history readable and makes it possible to automate changelogs later.

## Adding a changeset

If your PR changes the published behavior of any package under `packages/*` — a fix, a new feature, a breaking change — add a changeset before opening the PR:

```bash
pnpm changeset
```

It asks which package(s) are affected and the bump type (`patch` / `minor` / `major` — see [`AGENTS.md`](./AGENTS.md#4-versioning-and-changes) for what each means), then writes a `.changeset/*.md` file. Commit it with the rest of your PR — this is how the package's version and changelog entry get generated later, so a PR that changes published behavior with no changeset is incomplete. Internal-only changes (tests, tooling, `apps/website`) don't need one.

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Fill in the PR description: what changed, why, and how it was tested. Link any related issue.
3. Ensure the CI checks (typecheck, lint, test, build) pass — a PR with red checks will not be reviewed.
4. If your change affects the public API (anything exported from `src/index.ts`), call that out explicitly in the PR description and note whether it's a breaking change.
5. Include a changeset (see above) if your change affects a published package.
6. Be responsive to review feedback. A maintainer will merge once the PR is approved and CI is green.

## What you should *not* do

- Do not bump a package's `version` field or edit its `CHANGELOG.md` by hand — that's generated from changesets (see "Adding a changeset" above and the release process in `AGENTS.md`).
- Do not run `npm publish` / `pnpm publish` yourself, and don't merge the bot-authored "Version Packages" pull request unless you intend to trigger a release. Publishing to npm happens exclusively through the `.github/workflows/publish.yml` GitHub Actions workflow.
- Do not add a runtime dependency without discussing it first in an issue — this SDK aims for zero runtime dependencies whenever possible (see `AGENTS.md`).

## Reporting bugs / requesting features

Open a GitHub issue with:
- A clear description of the bug or the requested feature.
- Steps to reproduce (for bugs), including the SDK version and Node.js version.
- Expected vs. actual behavior.

Please do not include real secret keys or customer data in issues — use the third-party provider's test credentials when sharing reproduction steps.

## License

By contributing, you agree that your contributions will be licensed under the project's [ISC License](./LICENSE).
