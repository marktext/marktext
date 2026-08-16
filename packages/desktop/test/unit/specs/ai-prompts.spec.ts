import { describe, expect, it } from 'vitest'
import {
  answerSystemPrompt,
  buildDocumentContext,
  buildDocumentPrompt,
  buildPreciseEditRepairPrompt,
  buildPreciseEditSystemPrompt,
  connectionTestSystemPrompt,
  connectionTestUserPrompt,
  makePreciseEditMarkers,
  previousPreciseEditContextMessage,
  previousRewriteContextMessage,
  rewriteSystemPrompt
} from 'main_renderer/ai/prompts'

describe('AI prompt templates', () => {
  it('exposes the fixed mode and connection prompts', () => {
    expect(connectionTestSystemPrompt).toContain('testing an AI connection')
    expect(connectionTestUserPrompt).toBe('Reply with the single word OK.')
    expect(previousPreciseEditContextMessage).toContain('previous precise edit')
    expect(previousRewriteContextMessage).toContain('previous document rewrite')
    expect(answerSystemPrompt).toContain('Never rewrite or mutate the document')
    expect(rewriteSystemPrompt).toContain('complete revised Markdown document')
  })

  it('keeps precise edit markers synchronized with the system prompt', () => {
    const delimiter = 'MT_EDIT_TEST'
    const markers = makePreciseEditMarkers(delimiter)
    const system = buildPreciseEditSystemPrompt(delimiter)

    expect(system).toContain(markers.search)
    expect(system).toContain(markers.divider)
    expect(system).toContain(markers.replace)
    expect(system).toContain('NO_CHANGES')
  })

  it('builds document and repair messages without changing their boundaries', () => {
    expect(buildDocumentContext('# Old title')).toBe('\n\n<current_document>\n# Old title\n</current_document>')
    expect(buildDocumentPrompt('Change the title.', '# Old title')).toBe(
      'Change the title.\n\n<current_document>\n# Old title\n</current_document>'
    )
    expect(buildPreciseEditRepairPrompt('The SEARCH block did not match.')).toContain(
      'The SEARCH block did not match.'
    )
  })
})
