import { beforeEach, describe, expect, it } from 'vitest'
import Muya from 'muya/lib'

interface PluginEntry {
  plugin: {
    pluginName?: string
  }
  options: Record<string, unknown>
}

describe('Muya UI plugin registration', () => {
  beforeEach(() => {
    Muya.plugins = []
  })

  it('keeps one registration per pluginName', () => {
    class ToolbarPlugin {
      static pluginName = 'toolbar'
    }

    Muya.use(ToolbarPlugin, { placement: 'top' })
    Muya.use(ToolbarPlugin, { placement: 'bottom' })

    const plugins = Muya.plugins as PluginEntry[]

    expect(plugins).to.have.length(1)
    expect(plugins[0].plugin).to.equal(ToolbarPlugin)
    expect(plugins[0].options).to.deep.equal({ placement: 'bottom' })
  })

  it('updates the constructor and options when a pluginName is re-registered', () => {
    class InitialPlugin {
      static pluginName = 'linkTools'
    }

    class ReplacementPlugin {
      static pluginName = 'linkTools'
    }

    Muya.use(InitialPlugin, { jumpClick: 'initial' })
    Muya.use(ReplacementPlugin, { jumpClick: 'replacement' })

    const plugins = Muya.plugins as PluginEntry[]

    expect(plugins).to.have.length(1)
    expect(plugins[0].plugin).to.equal(ReplacementPlugin)
    expect(plugins[0].options).to.deep.equal({ jumpClick: 'replacement' })
  })
})
