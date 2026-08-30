# worktrunk-config

> Deno worktree hooks for `worktrunk` — the bash hooks from `systemfsoftware` rewritten as Deno scripts that live at the repo root.

`worktrunk` creates linked worktrees. These hooks warm the CodeGraph index, fix relative `gitdir` paths, symlink shared dirs, and install deps so a new worktree is ready in seconds.

```toml
# .config/wt.toml
[hooks]
pre-start  = "deno run --allow-read --allow-write --allow-run --allow-env ./pre-start.ts {{worktree_path}}"
post-switch = "deno run --allow-run ./post-switch.ts {{worktree_path}}"
pre-merge  = "deno run --allow-read --allow-write --allow-run ./pre-merge.ts {{worktree_path}}"
```

## Why this exists

`worktrunk` without hooks gives you an empty worktree — no index, broken `gitdir` on shared mounts, missing `.repos`/`wiki` symlinks. This repo is the Deno replacement for the bash `scripts/tools/worktrunk/*.sh` that previously did that work. Forward-looking: no exported functions in scripts, `lib/` split into focused modules, `dprint` formatting.

## Install

Requires [Deno 2.9+](https://deno.land/) and `dprint` for formatting.

```bash
git clone https://github.com/systemfsoftware/worktrunk-config.git
cd worktrunk-config
deno task check   # dprint check && deno lint
```

No publish step — `wt.toml` runs the scripts directly via `deno run`.

## Usage

Wire the hooks in `wt.toml` (or `.config/wt.toml` at the primary repo):

```toml
[hooks]
pre-start  = "deno run --allow-read --allow-write --allow-run --allow-env ./pre-start.ts {{worktree_path}} {{primary_path}}"
post-switch = "deno run --allow-run ./post-switch.ts {{worktree_path}}"
pre-merge  = "deno run --allow-read --allow-write --allow-run ./pre-merge.ts {{worktree_path}}"
post-start = "deno run --allow-read --allow-write --allow-run --allow-env ./copy-codegraph.ts {{worktree_path}} {{primary_path}}"
```

Run a hook manually:

```bash
deno run --allow-read --allow-write --allow-run --allow-env ./pre-start.ts /path/to/worktree
# -> pre-start: .repos -> ../primary/.repos
# -> pre-start: wiki -> ../primary/wiki
```

## Hooks

Each `*.ts` at the repo root is a plain CLI for a `wt.toml` trigger — `pre-start`, `post-start`, `post-switch`, `pre-merge`, or manual. See the `*.ts` files at the root for the current list; shared logic lives in `lib/` (`lib/git.ts`, `lib/paths.ts`, `lib/fs.ts`).

> [!NOTE]
> All scripts are plain CLIs — no exports. Shared logic lives in `lib/`.

## Configuration

Hooks read `{{worktree_path}}` as first arg and optional `{{primary_path}}` as second. When `primary_path` is omitted, `lib/git.ts:resolvePrimaryRepo` derives it via `git rev-parse --git-common-dir`. No config file.

## Comparison

| Feature | bash `*.sh` | Deno `*.ts` |
| --- | --- | --- |
| Path handling | `realpath --relative-to` (fails on missing) | `tryRelative` returns `null` |
| MCP provisioning | `python3` heredoc | `Deno.readTextFile` + `JSON.parse` |
| DB warm copy | shell fallback chain | `Deno.copyFile` with `sqlite3 PRAGMA quick_check` |
| Permissions | implicit | exact `--allow-*` in shebang |

## Troubleshooting

**`gitdir: ... -> ...` not printed?** Primary has no `.git/worktrees` yet — `pre-start` skips that step.

**`codegraph CLI not found, skipping init`?** Install `codegraph` via `~/.local/bin/codegraph` or `code` in PATH. Warm copy still skips gracefully.

**`dprint check` fails?** Run `dprint fmt` — repo uses `dprint.json` (`lineWidth:120`, `asi`, `preferSingle`) not `deno fmt`.

## Contributing

Development setup and workflow: [AGENTS.md](AGENTS.md) (or `docs/`).

## License

Same as `systemfsoftware` — see [LICENSE](LICENSE) if present.
