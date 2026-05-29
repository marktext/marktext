/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.svg?url' {
  const content: string
  export default content
}

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}

declare module '*.css?inline' {
  const content: string
  export default content
}

// 声明 JS 工具模块
declare module '../utils/scrollTo' {
  const scrollToElement: (selector: string) => void
  export default scrollToElement
}

declare module '../utils/scrollTo.js' {
  const scrollToElement: (selector: string) => void
  export default scrollToElement
}

declare module '../utils/markdownToHtml.js' {
  const markdownToHtml: (markdown: string) => string
  export default markdownToHtml
}

declare module '../utils/theme.js' {
  export function addThemeStyle(theme: string): void
}
