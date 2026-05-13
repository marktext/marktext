const DEFAULT_LANGUAGE = 'en'

const LOCALES = {
  'zh-CN': {
    'About MarkText': '关于 MarkText',
    'About MarkText...': '关于 MarkText...',
    'Add to Dictionary': '添加到词典',
    'Always on Top': '窗口置顶',
    'Auto Save': '自动保存',
    Bold: '加粗',
    'Bring All to Front': '全部置于前面',
    'Cadmium Light': '镉黄浅色',
    'Carriage return and line feed (CRLF)': '回车换行 (CRLF)',
    'Change Language...': '切换语言...',
    'Changelog...': '更新日志...',
    'Check for updates...': '检查更新...',
    'Clear Formatting': '清除格式',
    'Clear Recently Used': '清除最近使用',
    'Close Tab': '关闭标签页',
    'Close Window': '关闭窗口',
    'Code Fences': '代码块',
    'Command Palette...': '命令面板...',
    Copy: '复制',
    'Copy As Html': '复制为 HTML',
    'Copy As Markdown': '复制为 Markdown',
    'Copy as HTML': '复制为 HTML',
    'Copy as Markdown': '复制为 Markdown',
    'Create Paragraph': '创建段落',
    Cut: '剪切',
    Dark: '深色',
    'Delete Paragraph': '删除段落',
    'Demote Heading': '降低标题级别',
    'Donate via Open Collective...': '通过 Open Collective 捐赠...',
    Duplicate: '复制段落',
    Edit: '编辑',
    'Edit Dictionary...': '编辑词典...',
    Export: '导出',
    'Feedback via Twitter...': '通过 Twitter 反馈...',
    File: '文件',
    Find: '查找',
    'Find Next': '查找下一个',
    'Find Previous': '查找上一个',
    'Find in Folder': '在文件夹中查找',
    'Focus Mode': '专注模式',
    'Follow us on Github...': '在 GitHub 上关注我们...',
    'Follow us on Twitter...': '在 Twitter 上关注我们...',
    Format: '格式',
    'Front Matter': 'Front Matter',
    'Graphite Light': '石墨浅色',
    'Heading 1': '一级标题',
    'Heading 2': '二级标题',
    'Heading 3': '三级标题',
    'Heading 4': '四级标题',
    'Heading 5': '五级标题',
    'Heading 6': '六级标题',
    Help: '帮助',
    'Hide MarkText': '隐藏 MarkText',
    'Hide Others': '隐藏其他',
    Highlight: '高亮',
    'Horizontal Rule': '水平分割线',
    'Html Block': 'HTML 块',
    Hyperlink: '超链接',
    Image: '图片',
    'Import...': '导入...',
    'Inline Code': '行内代码',
    'Inline Math': '行内公式',
    'Insert Paragraph After': '在后面插入段落',
    'Insert Paragraph Before': '在前面插入段落',
    Italic: '斜体',
    'License...': '许可证...',
    'Line Ending': '换行符',
    'Line feed (LF)': '换行 (LF)',
    'Loose List Item': '松散列表项',
    'Markdown Reference...': 'Markdown 参考...',
    'Material Dark': 'Material 深色',
    'Math Block': '公式块',
    Minimize: '最小化',
    'Move To...': '移动到...',
    'New Tab': '新建标签页',
    'New Window': '新建窗口',
    'One Dark': 'One Dark 深色',
    'Open File...': '打开文件...',
    'Open Folder...': '打开文件夹...',
    'Open Recent': '打开最近使用',
    'Ordered List': '有序列表',
    Paragraph: '段落',
    Paste: '粘贴',
    'Paste As Plain Text': '粘贴为纯文本',
    'Paste as Plain Text': '粘贴为纯文本',
    Preferences: '偏好设置',
    'Preferences...': '偏好设置...',
    Print: '打印',
    'Promote Heading': '提升标题级别',
    'Quick Start...': '快速开始...',
    Quit: '退出',
    'Quit MarkText': '退出 MarkText',
    'Quote Block': '引用块',
    'Reload Images': '重新加载图片',
    'Reload window': '重新加载窗口',
    'Rename...': '重命名...',
    Replace: '替换',
    'Report Issue or Request Feature...': '报告问题或请求功能...',
    Save: '保存',
    'Save As...': '另存为...',
    Screenshot: '截屏',
    'Select All': '全选',
    Services: '服务',
    'Show All': '全部显示',
    'Show Developer Tools': '显示开发者工具',
    'Show Sidebar': '显示侧边栏',
    'Show Tab Bar': '显示标签栏',
    'Show in Full Screen': '全屏显示',
    'Source Code Mode': '源代码模式',
    'Spelling...': '拼写...',
    Strikethrough: '删除线',
    Subscript: '下标',
    Superscript: '上标',
    Table: '表格',
    'Task List': '任务列表',
    Theme: '主题',
    'Toggle Table of Contents': '切换目录',
    'Typewriter Mode': '打字机模式',
    'Ulysses Light': 'Ulysses 浅色',
    Underline: '下划线',
    Undo: '撤销',
    View: '视图',
    'Watch on GitHub...': '在 GitHub 上关注项目...',
    'Website...': '网站...',
    Window: '窗口',
    'Zoom In': '放大',
    'Zoom Out': '缩小'
  }
}

const stripMnemonic = label => label.replace(/&/g, '')

export const normalizeLanguage = language => {
  if (language === 'zh-CN' || language === 'zh') {
    return 'zh-CN'
  }
  return DEFAULT_LANGUAGE
}

export const createTranslator = language => {
  const messages = LOCALES[normalizeLanguage(language)]
  return label => {
    if (!label || !messages) {
      return label
    }

    const cleanLabel = stripMnemonic(label)
    const translated = messages[cleanLabel]
    if (!translated) {
      return label
    }

    return translated
  }
}

export const translateMenuTemplate = (template, language) => {
  const t = createTranslator(language)
  const translateItem = item => {
    if (item.label) {
      item.label = t(item.label)
    }
    if (Array.isArray(item.submenu)) {
      item.submenu.forEach(translateItem)
    }
    return item
  }

  if (Array.isArray(template)) {
    template.forEach(translateItem)
  } else if (template) {
    translateItem(template)
  }
  return template
}
