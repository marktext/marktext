export function shouldShowInAppTitleBar(titleBarStyle: string, isOsx: boolean): boolean {
  return titleBarStyle !== 'native' || isOsx
}
