import { inject, onBeforeUnmount, onMounted, watch, type InjectionKey, type Ref } from 'vue'

export type TreeRowRegistry = Map<string, HTMLElement>

export const TREE_ROW_REGISTRY_KEY: InjectionKey<TreeRowRegistry> = Symbol(
  'marktext:side-bar-tree-rows'
)

export const toRowKey = (pathname: string): string => window.path.normalize(pathname)

export const useTreeRow = (pathname: () => string, row: Ref<HTMLElement | null>): void => {
  const registry = inject(TREE_ROW_REGISTRY_KEY, null)
  const register = (): void => {
    if (row.value) registry?.set(toRowKey(pathname()), row.value)
  }
  watch(pathname, (_current, previous) => {
    registry?.delete(toRowKey(previous))
    register()
  })
  onMounted(register)
  onBeforeUnmount(() => { registry?.delete(toRowKey(pathname())) })
}
