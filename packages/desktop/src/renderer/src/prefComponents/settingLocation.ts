import { nextTick, onBeforeUnmount, watch } from 'vue'
import { useRoute, type Router } from 'vue-router'
import { preferenceDefinitions } from './registry'

export const settingTargetId = (key: string): string => `setting-${key}`

export const revealSetting = async(key: string): Promise<void> => {
  await nextTick()
  const fallback = preferenceDefinitions[key]?.fallback
  const findTarget = (): HTMLElement | null => {
    const target = document.getElementById(settingTargetId(key))
    if (target && getComputedStyle(target).display !== 'none') return target
    return fallback ? document.getElementById(settingTargetId(fallback)) : null
  }
  const highlight = (target: HTMLElement): void => {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    target.classList.remove('is-search-target')
    requestAnimationFrame(() => target.classList.add('is-search-target'))
  }
  const target = findTarget()
  if (target) {
    highlight(target)
    return
  }
  // Recovery controls mount after their acknowledged preference request resolves.
  await new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      const element = findTarget()
      if (!element) return
      highlight(element)
      finish()
    })
    const finish = (): void => {
      observer.disconnect()
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, 2000)
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

export const openSetting = async(router: Router, category: string, key: string): Promise<void> => {
  const path = `/preference/${category}`
  if (router.currentRoute.value.path === path && router.currentRoute.value.query.setting === key) {
    await revealSetting(key)
  } else {
    await router.push({ path, query: { setting: key } })
  }
}

export const useSettingLocation = (): void => {
  const route = useRoute()
  const stop = watch(() => route.fullPath, () => {
    const key = route.query.setting
    if (typeof key === 'string') void revealSetting(key)
  }, { immediate: true, flush: 'post' })
  onBeforeUnmount(stop)
}
