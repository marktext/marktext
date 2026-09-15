/**
 * Editor context menu — a custom HTML overlay for the WYSIWYG editor surface.
 *
 * MarkText ships no context menu for the editor body itself (side bar, tabs and
 * the source-code pane have their own). This module fills that gap with a
 * compact overlay: clipboard icons, inline formatting icons, the three most
 * frequent insert actions, a structural row and a hover-expanded sub panel.
 *
 * Everything is plain DOM so the overlay can be tested without mounting a
 * component. Actions are dispatched through the existing bus/command-center
 * pathways — the menu owns no editor logic of its own. All colors come from
 * the theme's :root CSS variables, so theme switches need no JS involvement.
 */
import bus from '../bus'
import { t } from '../i18n'
import { isOsx } from '@/util'

/** Command ids referenced by this menu. Exported so tests can assert every id
 *  exists in the command center — a renamed command must break the test, not
 *  silently throw at right-click time. */
export const CONTEXT_MENU_COMMAND_IDS = [
  'format.strong',
  'format.emphasis',
  'format.strike',
  'format.inline-code',
  'format.hyperlink',
  'paragraph.code-fence',
  'paragraph.table',
  'format.image',
  'paragraph.quote-block',
  'paragraph.bullet-list',
  'paragraph.order-list',
  'paragraph.task-list',
  'paragraph.horizontal-line',
  'paragraph.heading-1',
  'paragraph.heading-2',
  'paragraph.heading-3',
  'paragraph.math-formula',
  'format.inline-math',
  'paragraph.html-block',
  'edit.find',
  'paragraph.reset-paragraph'
] as const

/** Accelerators shown before the main process keybinding map arrives, and for
 *  entries the user has left unbound. */
const FALLBACK_ACCELERATORS: Record<string, string> = {
  'paragraph.code-fence': 'Ctrl+Shift+K',
  'paragraph.table': 'Ctrl+Shift+T',
  'format.image': 'Ctrl+Shift+I',
  'paragraph.quote-block': 'Ctrl+Shift+Q',
  'paragraph.bullet-list': 'Ctrl+H',
  'paragraph.order-list': 'Ctrl+G',
  'paragraph.task-list': 'Ctrl+Shift+X',
  'paragraph.horizontal-line': 'Ctrl+_',
  'paragraph.heading-1': 'Ctrl+Alt+1',
  'paragraph.heading-2': 'Ctrl+Alt+2',
  'format.strong': 'Ctrl+B',
  'format.emphasis': 'Ctrl+I',
  'format.strike': 'Alt+Shift+5',
  'format.inline-code': 'Ctrl+Y',
  'format.hyperlink': 'Ctrl+L',
  'format.inline-math': 'Ctrl+Shift+M',
  'edit.find': 'Ctrl+F'
}

/** Electron accelerator → short human label ("Cmd" on macOS, "Ctrl" elsewhere). */
export const formatAccelerator = (raw: string | undefined): string => {
  if (!raw) return ''
  const modifier = isOsx ? 'Cmd' : 'Ctrl'
  return String(raw)
    .replace(/CommandOrControl|CmdOrCtrl|Command|Cmd/gi, modifier)
    .replace(/Option/gi, 'Alt')
}

/** Clamp a floating panel of `w`×`h` into the viewport, flipping to the
 *  mouse's left/top side when it would overflow right/bottom. Pure function —
 *  jsdom has no layout, so boundary behaviour is only testable this way. */
export const clampPosition = (
  px: number,
  py: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = 6
): { x: number; y: number } => {
  let outX = px
  let outY = py
  if (w > vw - margin * 2) {
    outX = margin
  } else if (px + w > vw - margin) {
    outX = Math.max(margin, px - w)
    if (outX < margin) outX = vw - w - margin
  }
  if (h > vh - margin * 2) {
    outY = margin
  } else if (py + h > vh - margin) {
    outY = Math.max(margin, py - h)
    if (outY < margin) outY = vh - h - margin
  }
  return { x: Math.max(margin, outX), y: Math.max(margin, outY) }
}

const STYLE_ID = 'mt-ctx-menu-style'

const CSS = [
  '.mt-ctx{position:fixed;z-index:100000;min-width:196px;max-width:280px;',
  'background:var(--floatBgColor,#3f3f3f);color:var(--editorColor,#ddd);',
  'border:1px solid var(--floatBorderColor,rgba(0,0,0,.12));',
  'border-radius:6px;box-shadow:0 3px 12px var(--floatShadow,rgba(0,0,0,.25));',
  'padding:4px;font-size:13px;user-select:none;',
  'font-family:"Open Sans","Clear Sans","Helvetica Neue",Helvetica,Arial,sans-serif;',
  'box-sizing:border-box;}',
  '.mt-ctx *{box-sizing:border-box;}',
  '.mt-ctx-row{display:flex;align-items:center;gap:2px;padding:2px 0;}',
  '.mt-ctx-btn{position:relative;flex:1 1 0;min-width:0;height:28px;display:flex;',
  'align-items:center;justify-content:center;border:none;background:transparent;',
  'color:var(--editorColor80,var(--editorColor,#ccc));border-radius:4px;cursor:pointer;',
  'font-size:13px;padding:0;transition:background .12s,color .12s;}',
  '.mt-ctx-btn:hover:not(:disabled){background:var(--floatHoverColor,rgba(128,128,128,.18));',
  'color:var(--themeColor,#409eff);}',
  '.mt-ctx-btn:disabled{opacity:.35;cursor:default;}',
  '.mt-ctx-btn .mt-ctx-ic{display:flex;align-items:center;justify-content:center;',
  'width:16px;height:16px;line-height:1;}',
  '.mt-ctx-btn .mt-ctx-ic svg{width:16px;height:16px;fill:none;stroke:currentColor;',
  'stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}',
  '.mt-ctx-btn .mt-ctx-tx{font-size:13px;font-weight:600;line-height:1;',
  'font-family:"DejaVu Sans Mono","Source Code Pro",monospace;}',
  // Hint-on-hover via pure CSS; `title` would be uncontrollable native styling.
  '.mt-ctx-btn:hover:not(:disabled)::after{content:attr(data-hint);position:absolute;',
  'bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;',
  'background:var(--floatBgColor,#3f3f3f);color:var(--editorColor,#eee);',
  'border:1px solid var(--floatBorderColor,rgba(0,0,0,.15));border-radius:4px;',
  'padding:3px 7px;font-size:11px;font-weight:400;line-height:1.3;',
  'box-shadow:0 2px 6px var(--floatShadow,rgba(0,0,0,.25));pointer-events:none;z-index:1;}',
  '.mt-ctx-item{position:relative;display:flex;align-items:center;height:28px;',
  'padding:0 8px 0 10px;border-radius:4px;cursor:pointer;gap:8px;}',
  '.mt-ctx-item:hover:not(.is-disabled){background:var(--floatHoverColor,rgba(128,128,128,.18));',
  'color:var(--themeColor,#409eff);}',
  '.mt-ctx-item.is-disabled{opacity:.35;cursor:default;}',
  '.mt-ctx-item .mt-ctx-label{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;',
  'white-space:nowrap;color:inherit;}',
  '.mt-ctx-item .mt-ctx-acc{flex:0 0 auto;color:var(--editorColor50,#999);',
  'font-size:11px;font-family:"DejaVu Sans Mono","Source Code Pro",monospace;',
  'opacity:0;transition:opacity .12s;}',
  '.mt-ctx-item:hover:not(.is-disabled) .mt-ctx-acc{opacity:1;}',
  '.mt-ctx-sep{height:1px;margin:4px 6px;background:var(--floatBorderColor,rgba(128,128,128,.25));}',
  '.mt-ctx-head{padding:5px 10px 3px;font-size:11px;letter-spacing:.4px;',
  'color:var(--editorColor40,var(--editorColor50,#888));text-transform:uppercase;}',
  '.mt-ctx-sub{position:fixed;z-index:100001;min-width:180px;}'
].join('')

const ICONS: Record<string, string> = {
  cut: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
  selall: '<svg viewBox="0 0 24 24"><path d="M3 5V3h2M3 12v2M3 19v2h2M21 5V3h-2M21 12v2M21 19v2h-2M8 3h2M14 3h2M8 21h2M14 21h2M3 8v2M3 14v2M21 8v2M21 14v2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
  bold: '<svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>',
  italic: '<svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  strike: '<svg viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2 5.2M8 20h7a3 3 0 0 0 2-5.2"/><line x1="4" y1="12" x2="20" y2="12"/></svg>',
  code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  quote: '<svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h10M4 15h16M4 20h10"/></svg>',
  bullet: '<svg viewBox="0 0 24 24"><circle cx="5" cy="7" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="5" cy="17" r="1.3"/><path d="M10 7h10M10 12h10M10 17h10"/></svg>',
  order: '<svg viewBox="0 0 24 24"><path d="M10 7h10M10 12h10M10 17h10"/><path d="M4 6h1v4M4 14.5h2v1l-2 2h2"/></svg>',
  task: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="M5 8l1.5 1.5L9 7"/><path d="M13 8h8M13 16h8"/><rect x="3" y="13" width="6" height="6" rx="1"/></svg>',
  hr: '<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>'
}

/** Execute through the command center. It throws for unknown ids — swallow
 *  here so one stale id can never break the rest of the menu. */
const executeCommand = (commandId: string): void => {
  try {
    bus.emit('cmd::execute', commandId)
  } catch (err) {
    console.error('[contextMenu]', err)
  }
}

const ensureStyle = (): void => {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

const acceleratorFor = (commandId: string, keybindingMap: Record<string, string>): string => {
  return formatAccelerator(keybindingMap[commandId] || FALLBACK_ACCELERATORS[commandId])
}

const hasSelection = (): boolean => {
  try {
    const selection = window.getSelection()
    return !!(selection && selection.rangeCount && String(selection.toString()).length > 0)
  } catch {
    return false
  }
}

let initialized = false

const initEditorContextMenu = (): void => {
  if (initialized || typeof document === 'undefined') return
  initialized = true

  // The main process owns the real keybinding map (user-customisable); the
  // fallback table above only covers defaults.
  const keybindingMap: Record<string, string> = {}
  if (window.electron) {
    window.electron.ipcRenderer.on('mt::keybindings-response', (_e, map) => {
      if (map && typeof map === 'object') {
        Object.assign(keybindingMap, map)
      }
    })
    window.electron.ipcRenderer.send('mt::request-keybindings')
  }

  let panel: HTMLElement | null = null
  let subPanel: HTMLElement | null = null
  let offClick: ((ev: MouseEvent) => void) | null = null
  let offKey: ((ev: KeyboardEvent) => void) | null = null

  const destroy = (): void => {
    if (subPanel) {
      subPanel.remove()
      subPanel = null
    }
    if (panel) {
      panel.remove()
      panel = null
    }
    if (offClick) {
      document.removeEventListener('mousedown', offClick, true)
      offClick = null
    }
    if (offKey) {
      document.removeEventListener('keydown', offKey, true)
      offKey = null
    }
  }
  const destroySub = (): void => {
    if (subPanel) {
      subPanel.remove()
      subPanel = null
    }
  }

  const mkIconBtn = (
    iconKey: string,
    hintText: string,
    accel: string,
    onClick: () => void,
    disabled = false
  ): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.className = 'mt-ctx-btn'
    btn.type = 'button'
    btn.dataset.hint = hintText + (accel ? '  ' + accel : '')
    btn.innerHTML = '<span class="mt-ctx-ic">' + ICONS[iconKey] + '</span>'
    if (disabled) btn.disabled = true
    // Prevent the editor from losing its selection when a menu button is pressed.
    btn.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
    })
    btn.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      if (btn.disabled) return
      destroy()
      onClick()
    })
    return btn
  }

  const mkTextItem = (
    label: string,
    accel: string,
    onClick: () => void
  ): HTMLElement => {
    const item = document.createElement('div')
    item.className = 'mt-ctx-item'
    const labelEl = document.createElement('span')
    labelEl.className = 'mt-ctx-label'
    labelEl.textContent = label
    item.appendChild(labelEl)
    if (accel) {
      const acc = document.createElement('span')
      acc.className = 'mt-ctx-acc'
      acc.textContent = accel
      item.appendChild(acc)
    }
    item.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
    })
    item.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      destroy()
      onClick()
    })
    return item
  }

  const mkSep = (): HTMLElement => {
    const sep = document.createElement('div')
    sep.className = 'mt-ctx-sep'
    return sep
  }

  const mkRow = (buttons: HTMLElement[]): HTMLElement => {
    const row = document.createElement('div')
    row.className = 'mt-ctx-row'
    buttons.forEach((b) => row.appendChild(b))
    return row
  }

  const buildSubPanel = (anchor: HTMLElement): void => {
    destroySub()
    const sub = document.createElement('div')
    sub.className = 'mt-ctx mt-ctx-sub'

    // No group headings on purpose: the entries are self-descriptive and
    // adding them would require new locale keys for no reader benefit.
    ;(['1', '2', '3'] as const).forEach((n) => {
      sub.appendChild(mkTextItem(
        t('menu.paragraph.heading' + n),
        acceleratorFor('paragraph.heading-' + n, keybindingMap),
        () => executeCommand('paragraph.heading-' + n)
      ))
    })
    sub.appendChild(mkSep())
    sub.appendChild(mkTextItem(
      t('menu.paragraph.mathBlock'),
      acceleratorFor('paragraph.math-formula', keybindingMap),
      () => executeCommand('paragraph.math-formula')
    ))
    sub.appendChild(mkTextItem(
      t('menu.format.inlineMath'),
      acceleratorFor('format.inline-math', keybindingMap),
      () => executeCommand('format.inline-math')
    ))
    sub.appendChild(mkTextItem(t('menu.paragraph.htmlBlock'), '', () => executeCommand('paragraph.html-block')))
    sub.appendChild(mkSep())
    sub.appendChild(mkTextItem(
      t('menu.edit.find'),
      acceleratorFor('edit.find', keybindingMap),
      () => executeCommand('edit.find')
    ))
    sub.appendChild(mkTextItem(t('menu.paragraph.paragraph'), '', () => executeCommand('paragraph.reset-paragraph')))

    // Park next to the anchor panel, flipping to its left side when the
    // viewport is too narrow.
    const rect = anchor.getBoundingClientRect()
    sub.style.visibility = 'hidden'
    document.body.appendChild(sub)
    const subRect = sub.getBoundingClientRect()
    const sw = subRect.width || 190
    const sh = subRect.height || 300
    let sx = rect.right + 4
    if (sx + sw > window.innerWidth - 6) sx = rect.left - sw - 4
    const pos = clampPosition(sx, rect.top, sw, sh, window.innerWidth, window.innerHeight, 6)
    sub.style.left = pos.x + 'px'
    sub.style.top = pos.y + 'px'
    sub.style.visibility = ''
    subPanel = sub
  }

  const buildPanel = (x: number, y: number): HTMLElement => {
    const selectionEmpty = !hasSelection()
    const panelEl = document.createElement('div')
    panelEl.className = 'mt-ctx'

    // Clipboard row. Cut reuses the rich-text copy pathway (same as the
    // Edit menu) and removes the selection afterwards.
    panelEl.appendChild(mkRow([
      mkIconBtn('cut', t('menu.edit.cut'), isOsx ? 'Cmd+X' : 'Ctrl+X', () => {
        bus.emit('copyAsRich')
        setTimeout(() => {
          try {
            document.execCommand('delete')
          } catch {
            // Older engines may reject execCommand; the copy already happened.
          }
        }, 20)
      }, selectionEmpty),
      mkIconBtn('copy', t('menu.edit.copy'), isOsx ? 'Cmd+C' : 'Ctrl+C', () => {
        bus.emit('copyAsRich')
      }, selectionEmpty),
      mkIconBtn('paste', t('menu.edit.pasteAsPlainText'), isOsx ? 'Cmd+Shift+V' : 'Ctrl+Shift+V', () => {
        bus.emit('pasteAsPlainText')
      }),
      mkIconBtn('selall', t('menu.edit.selectAll'), isOsx ? 'Cmd+A' : 'Ctrl+A', () => {
        bus.emit('selectAll')
      })
    ]))

    panelEl.appendChild(mkSep())

    // Inline formatting row.
    panelEl.appendChild(mkRow([
      mkIconBtn('bold', t('menu.format.bold'), acceleratorFor('format.strong', keybindingMap),
        () => executeCommand('format.strong')),
      mkIconBtn('italic', t('menu.format.italic'), acceleratorFor('format.emphasis', keybindingMap),
        () => executeCommand('format.emphasis')),
      mkIconBtn('strike', t('menu.format.strikethrough'), acceleratorFor('format.strike', keybindingMap),
        () => executeCommand('format.strike')),
      mkIconBtn('code', t('menu.format.inlineCode'), acceleratorFor('format.inline-code', keybindingMap),
        () => executeCommand('format.inline-code')),
      mkIconBtn('link', t('menu.format.hyperlink'), acceleratorFor('format.hyperlink', keybindingMap),
        () => executeCommand('format.hyperlink'))
    ]))

    panelEl.appendChild(mkSep())

    // High-frequency inserts.
    panelEl.appendChild(mkTextItem(
      t('menu.paragraph.codeFences'),
      acceleratorFor('paragraph.code-fence', keybindingMap),
      () => executeCommand('paragraph.code-fence')
    ))
    panelEl.appendChild(mkTextItem(
      t('menu.paragraph.table'),
      acceleratorFor('paragraph.table', keybindingMap),
      () => executeCommand('paragraph.table')
    ))
    panelEl.appendChild(mkTextItem(
      t('menu.format.image'),
      acceleratorFor('format.image', keybindingMap),
      () => executeCommand('format.image')
    ))

    panelEl.appendChild(mkSep())

    // Structural row + hover-expanded "more" panel.
    const moreBtn = document.createElement('button')
    moreBtn.className = 'mt-ctx-btn'
    moreBtn.type = 'button'
    moreBtn.innerHTML = '<span class="mt-ctx-ic">' + ICONS.more + '</span>'
    moreBtn.addEventListener('mousedown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
    })
    moreBtn.addEventListener('mouseenter', () => buildSubPanel(panelEl))

    panelEl.appendChild(mkRow([
      mkIconBtn('quote', t('menu.paragraph.quoteBlock'), acceleratorFor('paragraph.quote-block', keybindingMap),
        () => executeCommand('paragraph.quote-block')),
      mkIconBtn('bullet', t('menu.paragraph.bulletList'), acceleratorFor('paragraph.bullet-list', keybindingMap),
        () => executeCommand('paragraph.bullet-list')),
      mkIconBtn('order', t('menu.paragraph.orderedList'), acceleratorFor('paragraph.order-list', keybindingMap),
        () => executeCommand('paragraph.order-list')),
      mkIconBtn('task', t('menu.paragraph.taskList'), acceleratorFor('paragraph.task-list', keybindingMap),
        () => executeCommand('paragraph.task-list')),
      mkIconBtn('hr', t('menu.paragraph.horizontalRule'), acceleratorFor('paragraph.horizontal-line', keybindingMap),
        () => executeCommand('paragraph.horizontal-line')),
      moreBtn
    ]))

    panelEl.style.visibility = 'hidden'
    document.body.appendChild(panelEl)
    const rect = panelEl.getBoundingClientRect()
    const pos = clampPosition(x, y, rect.width || 210, rect.height || 250, window.innerWidth, window.innerHeight, 6)
    panelEl.style.left = pos.x + 'px'
    panelEl.style.top = pos.y + 'px'
    panelEl.style.visibility = ''
    return panelEl
  }

  const open = (x: number, y: number): void => {
    destroy()
    ensureStyle()
    panel = buildPanel(x, y)

    // Timestamp instead of an async flag: the very same tick that opens the
    // panel sets it, so the opening click can never slip through.
    const openedAt = Date.now()
    offClick = (ev: MouseEvent) => {
      if (Date.now() - openedAt < 30) return
      if (panel && panel.contains(ev.target as Node)) return
      if (subPanel && subPanel.contains(ev.target as Node)) return
      destroy()
    }
    offKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') destroy()
    }
    document.addEventListener('mousedown', offClick, true)
    document.addEventListener('keydown', offKey, true)
  }

  document.addEventListener('contextmenu', (ev) => {
    const target = ev.target as HTMLElement | null
    if (!target || !target.closest) return
    if (!target.closest('.editor-wrapper')) return
    // Source-code pane and form fields keep their native menus.
    if (target.closest('.CodeMirror')) return
    if (target.closest('input, textarea')) return
    ev.preventDefault()
    ev.stopPropagation()
    try {
      open(ev.clientX, ev.clientY)
    } catch (err) {
      console.error('[contextMenu]', err)
    }
  }, true)

  // A stale overlay position is worse than no overlay.
  window.addEventListener('blur', destroy)
  window.addEventListener('resize', destroy)
}

export default initEditorContextMenu
