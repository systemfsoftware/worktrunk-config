# Contributing

## Workflow

Format and check before committing:

```bash
deno task fmt
deno task check
```

## Conventions

- Hook scripts at the repository root are standalone CLIs (no exports).
- Shared code lives in `lib/`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
