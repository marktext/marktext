/** editor.type
 * CSS internationalization utility
 * Used to dynamically set text content in CSS content properties
 */

class I18nCSS {
  constructor(t) {
    this.t = t || ((key) => key) // Translation function; returns the raw key if none is provided
    // Initialize CSS variables
    this.updateCSSVariables()
  }

  /**
   * Update CSS variable values
   */
  updateCSSVariables() {
    const root = document.documentElement

    // Helper function: get translated text, falling back to the default value if translation fails
    const getTranslation = (key, defaultValue) => {
      const translation = this.t(key)
      // If the translation function returns the key itself, the translation failed; use the default value
      return translation === key ? defaultValue : translation
    }

    // Update all CSS variables
    root.style.setProperty(
      '--i18n-highlight-start',
      `"${getTranslation('editor.highlight-start', ' [highlight start] ')}"`
    )
    root.style.setProperty(
      '--i18n-highlight-end',
      `"${getTranslation('editor.highlight-end', ' [highlight end] ')}"`
    )
    root.style.setProperty(
      '--i18n-type-at-to-insert',
      `"${getTranslation('editor.type-at-to-insert', 'Type @ to insert')}"`
    )
    root.style.setProperty(
      '--i18n-input-footnote-definition',
      `"${getTranslation('editor.input-footnote-definition', 'Input footnote definition')}"`
    )
    root.style.setProperty(
      '--i18n-input-yaml-front-matter',
      `"${getTranslation('editor.input-yaml-front-matter', 'Input YAML front matter')}"`
    )
    root.style.setProperty(
      '--i18n-input-language-identifier',
      `"${getTranslation('editor.input-language-identifier', 'Input language identifier')}"`
    )
    root.style.setProperty(
      '--i18n-input-mathematical-formula',
      `"${getTranslation('editor.input-mathematical-formula', 'Input mathematical formula')}"`
    )
    root.style.setProperty('--i18n-fence', `"${getTranslation('editor.fence', 'fence')}"`)
    root.style.setProperty('--i18n-indent', `"${getTranslation('editor.indent', 'indent')}"`)
    root.style.setProperty(
      '--i18n-front-matter-delimiter',
      `"${getTranslation('editor.front-matter-delimiter', 'front matter delimiter')}"`
    )
    root.style.setProperty(
      '--i18n-math-delimiter',
      `"${getTranslation('editor.math-delimiter', 'math delimiter')}"`
    )
    root.style.setProperty(
      '--i18n-mermaid-start',
      `"${getTranslation('editor.mermaid-start', 'mermaid start')}"`
    )
    root.style.setProperty(
      '--i18n-flowchart-start',
      `"${getTranslation('editor.flowchart-start', 'flowchart start')}"`
    )
    root.style.setProperty(
      '--i18n-sequence-start',
      `"${getTranslation('editor.sequence-start', 'sequence start')}"`
    )
    root.style.setProperty(
      '--i18n-plantuml-start',
      `"${getTranslation('editor.plantuml-start', 'plantuml start')}"`
    )
    root.style.setProperty(
      '--i18n-vega-lite-start',
      `"${getTranslation('editor.vega-lite-start', 'vega-lite start')}"`
    )
    root.style.setProperty(
      '--i18n-click-to-add-image',
      `"${getTranslation('editor.click-to-add-image', 'Click to add image')}"`
    )
    root.style.setProperty(
      '--i18n-load-image-failed',
      `"${getTranslation('editor.load-image-failed', 'Load image failed')}"`
    )

    // Add editing-related CSS variables
    const translations = {
      undo: this.t('edit.undo'),
      redo: this.t('edit.redo'),
      cut: this.t('edit.cut'),
      copy: this.t('edit.copy'),
      paste: this.t('edit.paste'),
      selectAll: this.t('edit.selectAll')
    }

    root.style.setProperty('--ag-undo', translations.undo || 'Undo')
    root.style.setProperty('--ag-redo', translations.redo || 'Redo')
    root.style.setProperty('--ag-cut', translations.cut || 'Cut')
    root.style.setProperty('--ag-copy', translations.copy || 'Copy')
    root.style.setProperty('--ag-paste', translations.paste || 'Paste')
    root.style.setProperty('--ag-selectAll', translations.selectAll || 'Select All')
  }

  /**
   * Set the translation function
   */
  setTranslationFunction(t) {
    this.t = t || ((key) => key)
    this.updateCSSVariables()
  }
}

export default I18nCSS
