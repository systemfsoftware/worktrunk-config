#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
const ISSUE_PATTERNS = [/^[0-9].*-.*\.md$/, /^T[0-9a-fA-F].*-.*\.md$/]

async function preMerge(worktreePath: string): Promise<void> {
  for (const re of ISSUE_PATTERNS) {
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
