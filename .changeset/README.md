# Changesets

This directory tracks pending package releases via [changesets](https://github.com/changesets/changesets).

When you make a change to any package under `packages/*` that consumers should know about (a public API change, a fix, a new feature), run:

```bash
pnpm changeset
```

Pick the affected package(s), the bump type (`patch` / `minor` / `major` — see [`AGENTS.md`](../AGENTS.md#4-versioning-and-changes) for what each means), and write a short summary. Commit the generated `.changeset/*.md` file with your PR — it becomes that package's changelog entry.

You don't need a changeset for internal-only changes (tests, tooling, `apps/website`, `examples/*`) that don't affect a published package's behavior.

Publishing itself is automated — see [`AGENTS.md`](../AGENTS.md#3-bundling-with-tsup-esm--cjs--types) for the full release flow. Nobody runs `pnpm changeset version` or `pnpm changeset publish` by hand.
