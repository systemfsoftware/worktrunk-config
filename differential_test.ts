import { assertEquals } from '@std/assert'
import { join } from '@std/path'
import { resolvePrimaryRepo } from './lib/git.ts'
import { tryRelative } from './lib/paths.ts'

Deno.test('differential: tryRelative against realpath --relative-to on existing dirs', async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: 'wt-rel-test-' })
  try {
    const from = join(tmpDir, 'a', 'b', 'c')
    const to = join(tmpDir, 'a', 'b', 'd', 'e')
    await Deno.mkdir(from, { recursive: true })
    await Deno.mkdir(to, { recursive: true })

    const denoRel = tryRelative(from, to)

    const cmd = new Deno.Command('realpath', {
      args: ['--relative-to=' + from, to],
      stdout: 'piped',
    })
    const { stdout } = await cmd.output()
    const bashRel = new TextDecoder().decode(stdout).trim()

    assertEquals(denoRel, bashRel)
  } finally {
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {})
  }
})

Deno.test('differential: resolvePrimaryRepo behavior on primary repo vs worktree', async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: 'wt-diff-test-' })
  try {
    const primaryDir = join(tmpDir, 'primary')
    await Deno.mkdir(primaryDir)

    await new Deno.Command('git', { args: ['init', '-b', 'main'], cwd: primaryDir }).output()
    await new Deno.Command('git', {
      args: ['config', 'user.email', 'test@example.com'],
      cwd: primaryDir,
    }).output()
    await new Deno.Command('git', {
      args: ['config', 'user.name', 'Tester'],
      cwd: primaryDir,
    }).output()
    await Deno.writeTextFile(join(primaryDir, 'init.txt'), 'hello')
    await new Deno.Command('git', { args: ['add', '.'], cwd: primaryDir }).output()
    await new Deno.Command('git', { args: ['commit', '-m', 'init'], cwd: primaryDir }).output()

    // 1. Check on primary repo
    const denoPrimaryResult = await resolvePrimaryRepo(primaryDir)

    const bashPrimaryCmd = new Deno.Command('bash', {
      args: ['-c', `. /tmp/upstream-bash/lib.sh && resolve_primary_repo "$1"`, '--', primaryDir],
      stdout: 'piped',
      stderr: 'piped',
    })
    const bashPrimaryOut = await bashPrimaryCmd.output()
    const bashPrimaryExit = bashPrimaryOut.code

    assertEquals(denoPrimaryResult, null)
    assertEquals(bashPrimaryExit, 1)

    // 2. Create a worktree
    const wtDir = join(tmpDir, 'wt-branch')
    await new Deno.Command('git', {
      args: ['worktree', 'add', '-b', 'feature', wtDir],
      cwd: primaryDir,
    }).output()

    // Check on worktree
    const denoWtResult = await resolvePrimaryRepo(wtDir)
    const realPrimary = await Deno.realPath(primaryDir)

    const bashWtCmd = new Deno.Command('bash', {
      args: ['-c', `. /tmp/upstream-bash/lib.sh && resolve_primary_repo "$1"`, '--', wtDir],
      stdout: 'piped',
      stderr: 'piped',
    })
    const bashWtOut = await bashWtCmd.output()
    const bashWtResult = new TextDecoder().decode(bashWtOut.stdout).trim()
    const bashWtExit = bashWtOut.code

    assertEquals(bashWtExit, 0)
    assertEquals(denoWtResult, realPrimary)
    assertEquals(bashWtResult, realPrimary)
  } finally {
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {})
  }
})

Deno.test('differential: convert-to-relative-paths matches bash transformation on real dirs', async () => {
  const tmpDirDeno = await Deno.makeTempDir({ prefix: 'wt-conv-deno-' })
  const tmpDirBash = await Deno.makeTempDir({ prefix: 'wt-conv-bash-' })
  try {
    for (const root of [tmpDirDeno, tmpDirBash]) {
      const primary = join(root, 'primary')
      await Deno.mkdir(primary)
      await new Deno.Command('git', { args: ['init', '-b', 'main'], cwd: primary }).output()
      await new Deno.Command('git', { args: ['config', 'user.email', 'a@b.com'], cwd: primary }).output()
      await new Deno.Command('git', { args: ['config', 'user.name', 'a'], cwd: primary }).output()
      await Deno.writeTextFile(join(primary, 'a'), 'a')
      await new Deno.Command('git', { args: ['add', '.'], cwd: primary }).output()
      await new Deno.Command('git', { args: ['commit', '-m', 'init'], cwd: primary }).output()

      const wt1 = join(root, 'wt1')
      await new Deno.Command('git', { args: ['worktree', 'add', '-b', 'wt1', wt1], cwd: primary }).output()

      const wt2 = join(root, 'wt2')
      await new Deno.Command('git', { args: ['worktree', 'add', '-b', 'wt2', wt2], cwd: primary }).output()
    }

    // Run Deno implementation (exits 0 cleanly)
    const denoCmd = new Deno.Command(Deno.execPath(), {
      args: [
        'run',
        '--allow-read',
        '--allow-write',
        join(Deno.cwd(), 'convert-to-relative-paths.ts'),
        tmpDirDeno,
      ],
      stdout: 'piped',
    })
    const denoOut = await denoCmd.output()
    assertEquals(denoOut.code, 0)

    // Run Upstream Bash implementation (ignoring bash's set -e + ((COUNT++)) exit 1 bug)
    const bashCmd = new Deno.Command('bash', {
      args: ['-c', `/tmp/upstream-bash/convert-to-relative-paths.sh "$1" || true`, '--', tmpDirBash],
      stdout: 'piped',
    })
    await bashCmd.output()

    // Assert converted content is identical
    const denoGit1 = await Deno.readTextFile(join(tmpDirDeno, 'wt1', '.git'))
    const bashGit1 = await Deno.readTextFile(join(tmpDirBash, 'wt1', '.git'))
    assertEquals(denoGit1.trim(), bashGit1.trim())

    const denoGit2 = await Deno.readTextFile(join(tmpDirDeno, 'wt2', '.git'))
    const bashGit2 = await Deno.readTextFile(join(tmpDirBash, 'wt2', '.git'))
    assertEquals(denoGit2.trim(), bashGit2.trim())
  } finally {
    await Deno.remove(tmpDirDeno, { recursive: true }).catch(() => {})
    await Deno.remove(tmpDirBash, { recursive: true }).catch(() => {})
  }
})

Deno.test('differential: worktree-to-relative matches bash transformation', async () => {
  const tmpDirDeno = await Deno.makeTempDir({ prefix: 'wt-wt2rel-deno-' })
  const tmpDirBash = await Deno.makeTempDir({ prefix: 'wt-wt2rel-bash-' })
  try {
    for (const root of [tmpDirDeno, tmpDirBash]) {
      const primaryDir = join(root, 'primary')
      const wtDir = join(root, 'worktree')
      await Deno.mkdir(primaryDir)

      await new Deno.Command('git', { args: ['init', '-b', 'main'], cwd: primaryDir }).output()
      await new Deno.Command('git', {
        args: ['config', 'user.email', 'test@example.com'],
        cwd: primaryDir,
      }).output()
      await new Deno.Command('git', {
        args: ['config', 'user.name', 'Tester'],
        cwd: primaryDir,
      }).output()
      await Deno.writeTextFile(join(primaryDir, 'init.txt'), 'hello')
      await new Deno.Command('git', { args: ['add', '.'], cwd: primaryDir }).output()
      await new Deno.Command('git', { args: ['commit', '-m', 'init'], cwd: primaryDir }).output()

      await new Deno.Command('git', {
        args: ['worktree', 'add', '-b', 'feat', wtDir],
        cwd: primaryDir,
      }).output()
    }

    // Run Deno worktree-to-relative (exits 0 cleanly)
    const denoCmd = new Deno.Command(Deno.execPath(), {
      args: [
        'run',
        '--allow-read',
        '--allow-write',
        '--allow-run',
        join(Deno.cwd(), 'worktree-to-relative.ts'),
        join(tmpDirDeno, 'worktree'),
      ],
      stdout: 'piped',
    })
    const denoOut = await denoCmd.output()
    assertEquals(denoOut.code, 0)

    // Run Bash worktree-to-relative (ignoring bash's set -e + ((COUNT++)) exit 1 bug)
    const bashCmd = new Deno.Command('bash', {
      args: ['-c', `/tmp/upstream-bash/worktree-to-relative.sh "$1" || true`, '--', join(tmpDirBash, 'worktree')],
      stdout: 'piped',
    })
    await bashCmd.output()

    const denoConverted = await Deno.readTextFile(
      join(tmpDirDeno, 'primary', '.git', 'worktrees', 'worktree', 'gitdir'),
    )
    const bashConverted = await Deno.readTextFile(
      join(tmpDirBash, 'primary', '.git', 'worktrees', 'worktree', 'gitdir'),
    )
    assertEquals(denoConverted.trim(), bashConverted.trim())
  } finally {
    await Deno.remove(tmpDirDeno, { recursive: true }).catch(() => {})
    await Deno.remove(tmpDirBash, { recursive: true }).catch(() => {})
  }
})

Deno.test('differential: post-switch unsets extensions.relativeWorktrees', async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: 'wt-postswitch-' })
  try {
    await new Deno.Command('git', { args: ['init'], cwd: tmpDir }).output()
    await new Deno.Command('git', {
      args: ['config', 'extensions.relativeWorktrees', 'true'],
      cwd: tmpDir,
    }).output()

    const denoCmd = new Deno.Command(Deno.execPath(), {
      args: ['run', '--allow-run', join(Deno.cwd(), 'post-switch.ts'), tmpDir],
      stdout: 'piped',
    })
    const denoOut = await denoCmd.output()
    assertEquals(denoOut.code, 0)

    const checkConfig = new Deno.Command('git', {
      args: ['-C', tmpDir, 'config', '--get', 'extensions.relativeWorktrees'],
    })
    const checkOut = await checkConfig.output()
    assertEquals(checkOut.code, 1) // unset returns 1
  } finally {
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {})
  }
})

Deno.test('differential: pre-merge cleans symlinked issue files and stages git', async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: 'wt-premerge-' })
  try {
    await new Deno.Command('git', { args: ['init'], cwd: tmpDir }).output()
    await new Deno.Command('git', {
      args: ['config', 'user.email', 'test@example.com'],
      cwd: tmpDir,
    }).output()
    await new Deno.Command('git', {
      args: ['config', 'user.name', 'Tester'],
      cwd: tmpDir,
    }).output()

    const realTarget = join(tmpDir, 'real-issue.txt')
    await Deno.writeTextFile(realTarget, 'content')
    await Deno.symlink(realTarget, join(tmpDir, '123-issue.md'))
    await Deno.symlink(realTarget, join(tmpDir, 'T1a2b-task.md'))
    await Deno.writeTextFile(join(tmpDir, 'keep-me.md'), 'keeper')

    const denoCmd = new Deno.Command(Deno.execPath(), {
      args: ['run', '--allow-read', '--allow-write', '--allow-run', join(Deno.cwd(), 'pre-merge.ts'), tmpDir],
      stdout: 'piped',
    })
    const denoOut = await denoCmd.output()
    assertEquals(denoOut.code, 0)

    let removed1 = false
    try {
      await Deno.lstat(join(tmpDir, '123-issue.md'))
    } catch {
      removed1 = true
    }
    let removed2 = false
    try {
      await Deno.lstat(join(tmpDir, 'T1a2b-task.md'))
    } catch {
      removed2 = true
    }
    assertEquals(removed1, true)
    assertEquals(removed2, true)

    const statKeep = await Deno.stat(join(tmpDir, 'keep-me.md'))
    assertEquals(statKeep.isFile, true)
  } finally {
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {})
  }
})

Deno.test('differential: pre-start relative conversion and shared directory linking matches bash', async () => {
  const tmpDirDeno = await Deno.makeTempDir({ prefix: 'wt-prestart-deno-' })
  const tmpDirBash = await Deno.makeTempDir({ prefix: 'wt-prestart-bash-' })
  try {
    for (const root of [tmpDirDeno, tmpDirBash]) {
      const primaryDir = join(root, 'primary')
      const wtDir = join(root, 'worktrees', 'wt1')
      await Deno.mkdir(primaryDir)
      await Deno.mkdir(join(root, 'worktrees'))

      await new Deno.Command('git', { args: ['init', '-b', 'main'], cwd: primaryDir }).output()
      await new Deno.Command('git', {
        args: ['config', 'user.email', 'test@example.com'],
        cwd: primaryDir,
      }).output()
      await new Deno.Command('git', {
        args: ['config', 'user.name', 'Tester'],
        cwd: primaryDir,
      }).output()
      await Deno.writeTextFile(join(primaryDir, 'file.txt'), 'hello')
      await new Deno.Command('git', { args: ['add', '.'], cwd: primaryDir }).output()
      await new Deno.Command('git', { args: ['commit', '-m', 'init'], cwd: primaryDir }).output()

      await Deno.mkdir(join(primaryDir, '.repos'))
      await Deno.mkdir(join(primaryDir, 'wiki'))

      await new Deno.Command('git', {
        args: ['worktree', 'add', '-b', 'feat', wtDir],
        cwd: primaryDir,
      }).output()
    }

    // Run Deno pre-start
    const denoCmd = new Deno.Command(Deno.execPath(), {
      args: [
        'run',
        '--allow-read',
        '--allow-write',
        '--allow-run',
        '--allow-env',
        join(Deno.cwd(), 'pre-start.ts'),
        join(tmpDirDeno, 'worktrees', 'wt1'),
        join(tmpDirDeno, 'primary'),
      ],
      stdout: 'piped',
      stderr: 'piped',
    })
    const denoOut = await denoCmd.output()
    assertEquals(denoOut.code, 0)

    // Run Bash pre-start
    const bashCmd = new Deno.Command('/tmp/upstream-bash/pre-start.sh', {
      args: [
        join(tmpDirBash, 'worktrees', 'wt1'),
        join(tmpDirBash, 'primary'),
      ],
      stdout: 'piped',
      stderr: 'piped',
    })
    const bashOut = await bashCmd.output()
    assertEquals(bashOut.code, 0)

    // Assert symlinks match
    const denoRepos = await Deno.readLink(join(tmpDirDeno, 'worktrees', 'wt1', '.repos'))
    const bashRepos = await Deno.readLink(join(tmpDirBash, 'worktrees', 'wt1', '.repos'))
    assertEquals(denoRepos, bashRepos)

    const denoWiki = await Deno.readLink(join(tmpDirDeno, 'worktrees', 'wt1', 'wiki'))
    const bashWiki = await Deno.readLink(join(tmpDirBash, 'worktrees', 'wt1', 'wiki'))
    assertEquals(denoWiki, bashWiki)

    // Assert gitdir in worktree matches
    const denoGit = await Deno.readTextFile(join(tmpDirDeno, 'worktrees', 'wt1', '.git'))
    const bashGit = await Deno.readTextFile(join(tmpDirBash, 'worktrees', 'wt1', '.git'))
    assertEquals(denoGit.trim(), bashGit.trim())
  } finally {
    await Deno.remove(tmpDirDeno, { recursive: true }).catch(() => {})
    await Deno.remove(tmpDirBash, { recursive: true }).catch(() => {})
  }
})
