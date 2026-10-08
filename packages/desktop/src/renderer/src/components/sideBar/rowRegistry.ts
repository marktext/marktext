import type { InjectionKey } from 'vue'

export type TreeRowRegistry = Map<string, HTMLElement>

export const TREE_ROW_REGISTRY_KEY: InjectionKey<TreeRowRegistry> = Symbol(
  'marktext:side-bar-tree-rows'
)

export const toRowKey = (pathname: string): string => window.path.normalize(pathname)
