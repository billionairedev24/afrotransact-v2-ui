/**
 * Tiny dependency-free user-agent parser for the account "active devices" view.
 * Good enough to label a session "Chrome on macOS" / "Safari on iPhone" — not a
 * full UA database. Works on both server and client.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown"

export interface DeviceInfo {
  browser: string
  os: string
  deviceType: DeviceType
  /** "Chrome on macOS" — or "Unknown device" when the UA is missing. */
  label: string
}

function detectOs(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows"
  if (/iPhone|iPod/i.test(ua)) return "iOS"
  if (/iPad/i.test(ua)) return "iPadOS"
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS"
  if (/Android/i.test(ua)) return "Android"
  if (/CrOS/i.test(ua)) return "ChromeOS"
  if (/Linux/i.test(ua)) return "Linux"
  return "Unknown OS"
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge"
  if (/OPR\/|Opera/i.test(ua)) return "Opera"
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet"
  if (/Firefox\//i.test(ua)) return "Firefox"
  if (/Chrome\//i.test(ua)) return "Chrome"
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "Safari"
  return "Unknown browser"
}

function detectDeviceType(ua: string): DeviceType {
  if (/iPad|Tablet/i.test(ua)) return "tablet"
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return "mobile"
  if (ua) return "desktop"
  return "unknown"
}

export function parseUserAgent(ua: string | undefined | null): DeviceInfo {
  const s = (ua || "").trim()
  if (!s) {
    return { browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown", label: "Unknown device" }
  }
  const browser = detectBrowser(s)
  const os = detectOs(s)
  const deviceType = detectDeviceType(s)
  return { browser, os, deviceType, label: `${browser} on ${os}` }
}
