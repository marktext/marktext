// Read the update capability computed by main during startup.
export const isUpdatable = (): boolean => {
  return !!(window.electron && window.electron.isUpdatable)
}
