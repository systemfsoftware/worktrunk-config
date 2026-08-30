#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
import { dirname, relative } from '@std/path'

/**
 * Convert all .git/worktrees/<name>/gitdir paths to relative.
 * Forward-looking: uses Deno APIs directly, idempotent, reports count.
 * CLI product output.
 */
async function worktreeToRelative(worktreePath = Deno.cwd()): Promise<number> {
  const gitCommonRaw = await runGitRevParse(worktreePath, '--git-common-dir')
  const primaryPath = await resolvePrimary(gitCommonRaw, worktreePath)
  if (!primaryPath) {
    console.error(`error: not a git repo at ${primaryPath}`)
    Deno.exit(1)
  }
  try {
    await Deno.stat(`${primaryPath}/.git`)
  } catch {
    console.error(`error: not a git repo at ${primaryPath}`)
    Deno.exit(1)
  }
  const worktreesDir = `${primaryPath}/.git/worktrees`
  try {
    await Deno.stat(worktreesDir)
  } catch {
    console.log('no worktrees')
    return 0
  }
  let count = 0
  for await (const entry of Deno.readDir(worktreesDir)) {
    const gitdirFile = `${worktreesDir}/${entry.name}/gitdir`
    let target: string
    try {
      target = (await Deno.readTextFile(gitdirFile)).trim()
    } catch {
      continue
    }
    if (!target.startsWith('/')) continue
    const baseDir = dirname(gitdirFile)
    let rel: string
    try {
      rel = relative(baseDir, target)
    } catch {
      continue
    }
    await Deno.writeTextFile(gitdirFile, rel + '\n')
    console.log(`  gitdir: ${entry.name} -> ${rel}`)
    count++
  }
  console.log(`converted ${count} worktree gitdir files`)
  return count
}

async function runGitRevParse(cwd: string, arg: string): Promise<string> {
  const cmd = new Deno.Command('git', {
    args: ['rev-parse', arg],
    cwd,
    stdout: 'piped',
    stderr: 'piped',
  })
  const { stdout } = await cmd.output()
  return new TextDecoder().decode(stdout).trim()
}

function resolvePrimary(gitCommonDir: string, worktreePath: string): string | null {
  if (!gitCommonDir) return null
  const abs = gitCommonDir.startsWith('/') ? gitCommonDir : `${worktreePath}/${gitCommonDir}`
  // gitCommonDir is ".../.git"; primary is parent of .git
  return dirname(abs)
}

if (import.meta.main) {
  const p = Deno.args[0] ?? Deno.cwd()
  await worktreeToRelative(p)
}
