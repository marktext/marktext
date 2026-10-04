import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { entriesFromPatch } from '@/agent/diffFiles'
import { useDiffStore } from '@/store/diff'

const PATCH = `diff --git a/docs/guide.md b/docs/guide.md
index 1111111..2222222 100644
--- a/docs/guide.md
+++ b/docs/guide.md
@@ -1,3 +1,4 @@
 line
-old
+new
+extra
diff --git a/notes.md b/notes.md
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/notes.md
@@ -0,0 +1 @@
+agent line
diff --git a/docs/intro.md b/docs/setup.md
similarity index 90%
rename from docs/intro.md
rename to docs/setup.md
index 1111111..2222222 100644
--- a/docs/intro.md
+++ b/docs/setup.md
@@ -1 +1 @@
-old
+new
diff --git a/archive/draft.md b/archive/draft.md
deleted file mode 100644
index 1111111..0000000
--- a/archive/draft.md
+++ /dev/null
@@ -1 +0,0 @@
-gone
`

describe('diff patch entries', () => {
  it('reads added, modified, renamed, and deleted files from a git patch', () => {
    expect(entriesFromPatch(PATCH)).toEqual([
      { path: 'docs/guide.md', kind: 'M', added: 2, deleted: 1 },
      { path: 'notes.md', kind: 'A', added: 1, deleted: 0 },
      { path: 'docs/setup.md', kind: 'R', added: 1, deleted: 1 },
      { path: 'archive/draft.md', kind: 'D', added: 0, deleted: 1 }
    ])
  })

  it('treats a blank patch as no files', () => {
    expect(entriesFromPatch('')).toEqual([])
    expect(entriesFromPatch('\n')).toEqual([])
  })
})

describe('diff tab store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens on a turn and steps back to the file without closing', () => {
    const diff = useDiffStore()
    diff.showTurn('turn-1', [])
    expect(diff.open).toBe(false)

    diff.showTurn('turn-1', ['notes.md'])
    expect(diff.open).toBe(true)
    expect(diff.active).toBe(true)
    expect(diff.scope).toBe('turn')
    expect(diff.turn).toMatchObject({ turnId: 'turn-1', paths: ['notes.md'] })

    diff.setScope('worktree')
    expect(diff.scope).toBe('worktree')

    diff.showFile()
    expect(diff.open).toBe(true)
    expect(diff.active).toBe(false)

    diff.activate()
    expect(diff.active).toBe(true)

    diff.close()
    expect(diff.open).toBe(false)
    expect(diff.active).toBe(false)
  })
})
