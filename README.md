# worktrunk-config

> Deno worktree hooks for `worktrunk` automating environment setup, warm-copy indexing, and path isolation.

When creating isolated git worktrees, new checkouts often start cold: index databases must be rebuilt from scratch, nested `.git` references break across directory boundaries, and development dependencies require manual setup. This repository provides executable TypeScript hooks that wire into `worktrunk` lifecycle events (`pre-start`, `post-start`, `post-switch`, `pre-merge`) to make every worktree immediately ready for development.

```toml
# .config/wt.toml
[hooks]
pre-start = "deno run --allow-read --allow-write --allow-run --allow-env ./pre-start.ts {{worktree_path}} {{primary_path}}"
post-start = "deno run --allow-read --allow-write --allow-run --allow-env ./copy-codegraph.ts {{worktree_path}} {{primary_path}}"
post-switch = "deno run --allow-run ./post-switch.ts {{worktree_path}}"
pre-merge = "deno run --allow-read --allow-write --allow-run ./pre-merge.ts {{worktree_path}}"
```

## Quick Start

Ensure [Deno](https://deno.land/) is installed on your workstation, then verify the codebase:

```bash
git clone https://github.com/systemfsoftware/worktrunk-scripts.git
cd worktrunk-scripts
deno task check
```

The hooks execute directly with `deno run` using explicit permission flags declared in each script's shebang.

## Architecture

Hooks in this repository are decoupled into two distinct structural layers:

- **Executable Hooks (`*.ts`):** Top-level standalone scripts targeted by `wt.toml` lifecycle events. Each hook is a self-contained command-line entrypoint that reads positional paths (`{{worktree_path}}` and optional `{{primary_path}}`) from `worktrunk` and runs without exporting library code.
- **Core Library (`lib/`):** Reusable platform utilities providing robust git directory resolution, resilient relative path mapping that gracefully handles cross-device boundaries, and common filesystem assertions.

```
worktrunk-config/
├── *.ts              # Standalone CLI lifecycle hooks
├── lib/
│   ├── fs.ts         # Filesystem helpers
│   ├── git.ts        # Git directory resolution and subprocess helpers
│   ├── paths.ts      # Resilient path relativity utilities
│   └── mod.ts        # Library module exports
├── deno.json         # Deno runtime tasks and linting config
└── dprint.json       # Code formatting configuration
```

## Configuration

In your primary repository, configure `worktrunk` to call the desired hook scripts in `.config/wt.toml`. Every script accepts standard arguments supplied by the runner:

```bash
deno run --allow-read --allow-write --allow-run --allow-env ./<hook-name>.ts <worktree_path> [primary_path]
```

If the secondary `primary_path` argument is omitted, the hook automatically resolves the primary repository root using the shared git common directory.

## Quality Gates

Code formatting and linting are enforced via `dprint` and `deno lint`:

```bash
deno task fmt       # Format all files using dprint
deno task check     # Run dprint verification and deno lint
```

## Contributing

For internal development procedures, agent instructions, and architecture patterns, see [docs/](docs/).

## License

See [LICENSE](LICENSE) for terms.
