/// <reference types="vite/client" />

// Raw markdown imports (`assetsInclude: ['**/*.md']` in electron.vite.config.ts)
declare module '*.md' {
  const content: string
  export default content
}
declare module '*.md?raw' {
  const content: string
  export default content
}

// SVGs imported as Vue components via vite-svg-loader
declare module '*.svg?component' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
declare module '*.svg' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

// SFC type stub — vue-tsc handles concrete typing for files with lang="ts"
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
