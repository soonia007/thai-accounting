import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/** Android hardware back button: navigate back, or exit the app at the root. */
export function setupNativeBackButton() {
  if (!Capacitor.isNativePlatform()) return
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void CapApp.exitApp()
  })
}
