import { notify } from "./platform.mjs";

/**
 * Show a desktop notification on the current platform (macOS / Windows / Linux).
 * Named `showMacNotification` for backwards compatibility with existing callers.
 */
export async function showMacNotification(title, message) {
  await notify(title, message);
}
