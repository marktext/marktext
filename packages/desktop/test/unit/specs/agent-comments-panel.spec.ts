import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import type { Message, Thread } from '@shared/types/comments'
import type { AnchorResolution } from '@/agent/anchoring'
import en from '../../../static/locales/en.json'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.path = {
    sep: '/',
    dirname: (p: string) => p,
    relative: (from: string, to: string) => to,
    isAbsolute: (p: string) => p.startsWith('/')
  }
  w.window.fileUtils = {
    hasMarkdownExtension: (name: string) => name.toLowerCase().endsWith('.md')
  }
  w.window.electron = {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => () => {} }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import CommentsTab from '@/components/agentPanel/commentsTab.vue'
import ThreadView from '@/components/agentPanel/threadView.vue'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import { useAgentStore } from '@/store/agent'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en }
})

const win = window as unknown as {
  comments: { load: Mock; mutate: Mock; onChanged: Mock }
}

const human = (id: string, text: string): Message => ({
  id,
  author: { kind: 'human', name: 'Ada' },
  text,
  createdAt: '2026-10-02T15:04:00.000Z',
  editedAt: null
})

const agent = (id: string, text: string): Message => ({
  id,
  author: { kind: 'agent', harness: 'opencode', model: 'anthropic/claude-sonnet-4-5' },
  text,
  createdAt: '2026-10-02T15:08:00.000Z',
  turnId: 'turn-1'
})

const thread = (
  id: string,
  quote: string,
  status: Thread['status'],
  messages: Message[]
): Thread => ({
  id,
  status,
  createdAt: '2026-10-02T15:04:00.000Z',
  closedAt: status === 'closed' ? '2026-10-02T18:00:00.000Z' : null,
  anchor: {
    quote,
    prefix: '',
    suffix: '',
    blockHint: { type: 'paragraph', index: 0 }
  },
  messages
})

const anchored = (index: number, start = 0): AnchorResolution => ({
  status: 'anchored',
  index,
  start,
  end: start + 1
})

const mountWith = (component: unknown): VueWrapper => {
  return mount(component, {
    global: { plugins: [i18n] }
  })
}

describe('comments panel', () => {
  let mutate: Mock
  const wrappers: VueWrapper[] = []

  const mountPanel = (component: unknown): VueWrapper => {
    const wrapper = mountWith(component)
    wrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    mutate = vi.fn(() => Promise.resolve({
      version: 1,
      file: 'docs/guide.md',
      threads: []
    }))
    win.comments = {
      load: vi.fn(),
      mutate,
      onChanged: vi.fn(() => () => {})
    }
    setActivePinia(createPinia())
    const comments = useCommentsStore()
    comments.availability = { kind: 'ready', file: 'docs/guide.md' }
    useAgentStore().repoState = { kind: 'repo', root: '/repo', userName: 'Ada' }
    useEditorStore().currentFile = {
      id: 'tab-1',
      filename: 'guide.md',
      pathname: '/repo/docs/guide.md',
      markdown: 'alpha\n'
    } as ReturnType<typeof useEditorStore>['currentFile']
  })

  afterEach(() => {
    for (const wrapper of wrappers) wrapper.unmount()
    wrappers.length = 0
    useCommentsStore().stop()
  })

  it('hides closed threads until show closed is on', async() => {
    const comments = useCommentsStore()
    comments.threads = [
      thread('open', 'open quote', 'open', [human('h1', 'note')]),
      thread('shut', 'closed quote', 'closed', [human('h2', 'done')])
    ]
    comments.resolved = new Map([
      ['open', anchored(0)],
      ['shut', anchored(1)]
    ])

    const wrapper = mountPanel(CommentsTab)
    expect(wrapper.text()).toContain('open quote')
    expect(wrapper.text()).not.toContain('closed quote')

    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.text()).toContain('closed quote')
    expect(wrapper.text()).toContain('closed')
  })

  it('lists detached threads in a group after the anchored ones', () => {
    const comments = useCommentsStore()
    comments.threads = [
      thread('loose', 'orphan quote', 'open', [human('h1', 'note')]),
      thread('held', 'anchored quote', 'open', [human('h2', 'note')])
    ]
    comments.resolved = new Map([
      ['loose', { status: 'orphaned' }],
      ['held', anchored(0)]
    ])

    const wrapper = mountPanel(CommentsTab)
    const html = wrapper.html()
    const groupAt = html.indexOf('Detached from the text')
    expect(groupAt).toBeGreaterThan(html.indexOf('anchored quote'))
    expect(html.indexOf('orphan quote')).toBeGreaterThan(groupAt)
    expect(wrapper.get('[data-thread="loose"]').text()).toContain('detached')
  })

  it('gives agent replies no menu', async() => {
    const comments = useCommentsStore()
    comments.threads = [
      thread('t1', 'alpha quote', 'open', [
        human('h1', 'Check the root.'),
        agent('a1', 'The lockfile is at the root.')
      ])
    ]
    comments.resolved = new Map([['t1', anchored(0)]])
    comments.selectedThreadId = 't1'

    const wrapper = mountPanel(ThreadView)
    const agentRow = wrapper.get('[data-kind="agent"]')
    expect(agentRow.find('[aria-label="Reply actions"]').exists()).toBe(false)
    expect(agentRow.find('[role="menu"]').exists()).toBe(false)
    expect(agentRow.text()).toContain('OpenCode · anthropic/claude-sonnet-4-5')

    await wrapper.get('[data-kind="human"] [aria-label="Reply actions"]').trigger('click')
    expect(wrapper.get('[data-kind="human"] [role="menu"]').text()).toContain('Edit')
  })

  it('deletes a thread only after confirmation', async() => {
    const comments = useCommentsStore()
    comments.threads = [thread('t1', 'alpha quote', 'open', [human('h1', 'Check the root.')])]
    comments.resolved = new Map([['t1', anchored(0)]])
    comments.selectedThreadId = 't1'

    const wrapper = mountPanel(ThreadView)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    const deleteButtons = (): ReturnType<VueWrapper['findAll']> =>
      wrapper.findAll('button').filter((button) => button.text() === 'Delete')
    await deleteButtons()[0]?.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(mutate).not.toHaveBeenCalled()

    await wrapper.get('[role="dialog"]').get('button.btn').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(mutate).not.toHaveBeenCalled()

    await deleteButtons()[0]?.trigger('click')
    await wrapper.get('[role="dialog"]').get('button.danger').trigger('click')
    expect(mutate).toHaveBeenCalledWith({ op: 'deleteThread', threadId: 't1' })
  })

  it('adds a reply on Ctrl+Enter', async() => {
    const comments = useCommentsStore()
    const current = thread('t1', 'alpha quote', 'open', [human('h1', 'Check the root.')])
    comments.threads = [current]
    comments.resolved = new Map([['t1', anchored(0)]])
    comments.selectedThreadId = 't1'
    mutate.mockResolvedValue({
      version: 1,
      file: 'docs/guide.md',
      threads: [current]
    })

    const wrapper = mountPanel(ThreadView)
    const field = wrapper.get('textarea')
    await field.setValue('hello')
    await field.trigger('keydown', { key: 'Enter' })
    expect(mutate).not.toHaveBeenCalled()

    await field.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(mutate).toHaveBeenCalledWith({
      op: 'addHumanMessage',
      threadId: 't1',
      text: 'hello'
    })
  })

  it('saves a draft on Ctrl+Enter and drops it on Escape', async() => {
    const comments = useCommentsStore()
    comments.openDraft({
      anchor: {
        quote: 'strict',
        prefix: '',
        suffix: '',
        blockHint: { type: 'paragraph', index: 0 }
      },
      quote: 'strict',
      text: ''
    })
    const created = thread('t-new', 'strict', 'open', [human('h-new', 'look here')])
    mutate.mockResolvedValue({
      version: 1,
      file: 'docs/guide.md',
      threads: [created]
    })

    const wrapper = mountPanel(CommentsTab)
    expect(wrapper.text()).toContain('New comment')
    expect(wrapper.text()).toContain('strict')
    expect(wrapper.get('button.primary').attributes('disabled')).toBeDefined()

    const field = wrapper.get('textarea')
    await field.setValue('look here')
    await field.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'createThread', firstText: 'look here' })
    )
    await vi.waitFor(() => {
      expect(comments.selectedThreadId).toBe('t-new')
    })
    expect(comments.draft).toBeNull()

    comments.openDraft({
      anchor: {
        quote: 'strict',
        prefix: '',
        suffix: '',
        blockHint: { type: 'paragraph', index: 0 }
      },
      quote: 'strict',
      text: 'drop me'
    })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('New comment')
    })
    await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    expect(comments.draft).toBeNull()
    expect(mutate).toHaveBeenCalledTimes(1)
  })
})
