import { describe, expect, it, vi } from 'vitest'
import {
  documentEditAgentLimits,
  runDocumentEditAgent,
  type DocumentEditAgentRequest,
  type DocumentEditGenerateRequest,
  type DocumentEditValidationDiagnostic
} from 'main_renderer/ai/documentEditAgent'

const request = (
  markdown: string,
  generate: (input: DocumentEditGenerateRequest) => Promise<{ content: string; truncated?: boolean }>,
  options: Pick<DocumentEditAgentRequest, 'onValidationFailure'> = {}
) =>
  runDocumentEditAgent({
    markdown,
    instruction: 'Make the requested change.',
    contextMessages: [],
    requestId: 'test-request',
    signal: new AbortController().signal,
    generate,
    ...options
  })

const responseWith = (system: string, search: string, replace: string): string => {
  const delimiter = system.match(/MT_EDIT_[a-f0-9]+/)?.[0]
  if (!delimiter) throw new Error('The test prompt did not contain an edit delimiter.')
  return [
    `<<<<<<< SEARCH ${delimiter}`,
    search,
    `======= ${delimiter}`,
    replace,
    `>>>>>>> REPLACE ${delimiter}`
  ].join('\n')
}

describe('document edit agent', () => {
  it('applies one exact local replacement and reports changed lines', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => ({
      content: responseWith(input.system, 'old title', 'new title')
    }))

    const result = await request('# old title\n\nKeep this.', generate)

    expect(result.markdown).toBe('# new title\n\nKeep this.')
    expect(result.summary).toEqual({
      operationCount: 1,
      addedLines: 1,
      removedLines: 1,
      operations: [{
        startLine: 1,
        endLine: 1,
        addedLines: 1,
        removedLines: 1,
        afterStartLine: 1,
        afterEndLine: 1,
        afterStartOffset: 2,
        afterEndOffset: 5
      }]
    })
    expect(result.attempts).toBe(1)
  })

  it('retries a non-unique block once and applies the corrected block', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => {
      if (generate.mock.calls.length === 1) return { content: responseWith(input.system, 'old', 'new') }
      return { content: responseWith(input.system, 'old\nold', 'new\nold') }
    })

    const result = await request('old\nold', generate)

    expect(result.markdown).toBe('new\nold')
    expect(result.attempts).toBe(2)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('accepts standard Aider-style divider and closing markers without the request token', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => {
      const delimiter = input.system.match(/MT_EDIT_[a-f0-9]+/)?.[0]
      if (!delimiter) throw new Error('The test prompt did not contain an edit delimiter.')
      return {
        content: [
          '<<<<<<< SEARCH',
          'old',
          '=======',
          'new',
          '>>>>>>> REPLACE'
        ].join('\n')
      }
    })

    const result = await request('old', generate)
    expect(result.markdown).toBe('new')
    expect(result.attempts).toBe(1)
  })

  it('validates all blocks before applying multiple edits', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => {
      const delimiter = input.system.match(/MT_EDIT_[a-f0-9]+/)?.[0]
      if (!delimiter) throw new Error('The test prompt did not contain an edit delimiter.')
      return {
        content: [
          `<<<<<<< SEARCH ${delimiter}`,
          'first',
          `======= ${delimiter}`,
          'one',
          `>>>>>>> REPLACE ${delimiter}`,
          `<<<<<<< SEARCH ${delimiter}`,
          'third',
          `======= ${delimiter}`,
          'three',
          `>>>>>>> REPLACE ${delimiter}`
        ].join('\n')
      }
    })

    const result = await request('first\nsecond\nthird', generate)
    expect(result.markdown).toBe('one\nsecond\nthree')
    expect(result.summary.operationCount).toBe(2)
  })

  it('rejects overlapping blocks instead of partially applying them', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => {
      const delimiter = input.system.match(/MT_EDIT_[a-f0-9]+/)?.[0]
      if (!delimiter) throw new Error('The test prompt did not contain an edit delimiter.')
      return {
        content: [
          `<<<<<<< SEARCH ${delimiter}`,
          'alpha',
          `======= ${delimiter}`,
          'one',
          `>>>>>>> REPLACE ${delimiter}`,
          `<<<<<<< SEARCH ${delimiter}`,
          'alpha beta',
          `======= ${delimiter}`,
          'two',
          `>>>>>>> REPLACE ${delimiter}`
        ].join('\n')
      }
    })

    await expect(request('alpha beta', generate)).rejects.toThrow('overlap')
    expect(generate).toHaveBeenCalledTimes(documentEditAgentLimits.maxAttempts)
  })

  it('fails without changing anything after two invalid responses', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => ({
      content: `${responseWith(input.system, 'missing', 'new')}\nUnexpected explanation`
    }))
    const diagnostics: DocumentEditValidationDiagnostic[] = []

    await expect(request('existing', generate, {
      onValidationFailure: diagnostic => diagnostics.push(diagnostic)
    })).rejects.toThrow('after 2 attempts')
    expect(generate).toHaveBeenCalledTimes(documentEditAgentLimits.maxAttempts)
    expect(diagnostics).toHaveLength(documentEditAgentLimits.maxAttempts)
    expect(diagnostics[0]).toMatchObject({
      attempt: 1,
      responseChars: expect.any(Number),
      responseLines: 6,
      searchMarkers: 1,
      dividerMarkers: 1,
      replaceMarkers: 1,
      legacySearchMarkers: 0,
      legacyDividerMarkers: 0,
      legacyReplaceMarkers: 0
    })
  })

  it('supports inserting into an empty document and no-op responses', async() => {
    const generate = vi.fn(async(input: DocumentEditGenerateRequest) => ({
      content: responseWith(input.system, '', '# Added')
    }))
    const result = await request('', generate)
    expect(result.markdown).toBe('# Added')
    expect(result.summary.addedLines).toBe(1)

    const noChanges = await request('already done', vi.fn(async() => ({ content: 'NO_CHANGES' })))
    expect(noChanges.markdown).toBe('already done')
    expect(noChanges.summary).toEqual({
      operationCount: 0,
      addedLines: 0,
      removedLines: 0,
      operations: []
    })
  })

  it('rejects truncated model output', async() => {
    const generate = vi.fn(async() => ({ content: '', truncated: true }))
    await expect(request('existing', generate)).rejects.toThrow('truncated')
    expect(generate).toHaveBeenCalledTimes(documentEditAgentLimits.maxAttempts)
  })
})
