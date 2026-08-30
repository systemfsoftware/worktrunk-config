# Contributing

## Setup

Requires [Deno 2.9+](https://deno.land/) and [dprint](https://dprint.dev/).

```bash
deno task fmt       # Format files via dprint
deno task check     # dprint check && deno lint
deno task test      # Run Deno test suite
```

## Structure & Invariants

- Hook scripts live directly at the repository root as standalone CLI entrypoints (`*.ts`).
- Hook scripts must never export symbols.
- Shared utilities live in `lib/` (`lib/git.ts`, `lib/paths.ts`, `lib/fs.ts`).
- Code formatting is governed by `dprint.json` (`lineWidth: 120`, `asi`, `preferSingle`).
- Verification gate before any commit: `deno task check`.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add post-merge hook for branch cleanup
fix(lib/git): handle detached HEAD during primary repo resolution
docs: clarify wt.toml hook configuration
```
