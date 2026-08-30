#!/usr/bin/env -S deno run --allow-read --allow-run
import { exists } from '@std/fs'

async function generateArtifacts(worktreePath: string): Promise<void> {
  // Product output: status lines are the CLI interface
  console.log('generate-artifacts: generating build artifacts...')
  if (await exists(`${worktreePath}/pnpm-lock.yaml`)) {
    const cmd = new Deno.Command('corepack', { args: ['pnpm', 'build'], cwd: worktreePath })
    await cmd.output()
  } else if (await exists(`${worktreePath}/package-lock.json`)) {
    const cmd = new Deno.Command('npm', { args: ['run', 'build'], cwd: worktreePath })
    await cmd.output()
  } else if (await exists(`${worktreePath}/yarn.lock`)) {
    const cmd = new Deno.Command('yarn', { args: ['build'], cwd: worktreePath })
    await cmd.output()
  } else if (await exists(`${worktreePath}/bun.lock`)) {
    const cmd = new Deno.Command('bun', { args: ['run', 'build'], cwd: worktreePath })
    await cmd.output()
  } else if (await exists(`${worktreePath}/Cargo.toml`)) {
    const cmd = new Deno.Command('cargo', { args: ['build'], cwd: worktreePath })
    await cmd.output()
  } else if (await exists(`${worktreePath}/go.mod`)) {
    const cmd = new Deno.Command('go', { args: ['build', './...'], cwd: worktreePath })
    await cmd.output()
  } else {
    console.log('generate-artifacts: no recognized build system, skipping')
  }
  console.log('generate-artifacts: done')
}

if (import.meta.main) {
  const p = Deno.args[0]
  if (!p) {
    console.error('worktree_path required')
    Deno.exit(1)
  }
  await generateArtifacts(p!)
}
