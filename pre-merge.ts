#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
const ISSUE_GLOBS = ['[0-9]*-*.md', 'T[0-9a-fA-F]*-*.md']

function globToRegExp(glob: string): RegExp {
  return new RegExp(
    '^' +
      glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  )
}

async function preMerge(worktreePath: string): Promise<void> {
  for (const pattern of ISSUE_GLOBS) {
    const re = globToRegExp(pattern)
    for await (const entry of Deno.readDir(worktreePath)) {
      if (!re.test(entry.name)) continue
      const full = `${worktreePath}/${entry.name}`
      try {
        const st = await Deno.lstat(full)
        if (st.isSymlink) {
          await Deno.remove(full)
          console.log(`pre-merge: removed symlinked issue ${entry.name}`)
        }
      } catch {
        continue
      }
    }
  }
  const cmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'add', '-A'],
    stdout: 'null',
    stderr: 'null',
  })
  await cmd.output()
}

if (import.meta.main) {
  const p = Deno.args[0]
  if (!p) {
    console.error('worktree_path required')
    Deno.exit(1)
  }
  await preMerge(p!)
}
