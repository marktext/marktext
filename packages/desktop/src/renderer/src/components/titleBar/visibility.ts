// The native OS title bar already shows document.title, so the in-app bar
// drops its own filename there. The bar itself stays for the toolbar items.
export function shouldShowInAppTitle(titleBarStyle: string, isOsx: boolean): boolean {
  return titleBarStyle !== 'native' || isOsx
}
