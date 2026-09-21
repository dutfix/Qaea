/**
 * Emergent-managed Google sign-in helpers.
 *
 * The flow: open https://auth.emergentagent.com/?redirect=<our url> → Google →
 * Emergent redirects back to <our url>#session_id=… (or ?session_id=…). The
 * one-time `session_id` is then exchanged (exactly once, by our backend) for an
 * app JWT via POST /api/auth/session. This module only knows how to open the
 * auth page and read the callback URL — it never talks to Emergent directly.
 */
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  // Lets the auth browser tab close itself once the deep link is delivered.
  WebBrowser.maybeCompleteAuthSession();
}

const EMERGENT_AUTH_URL = "https://auth.emergentagent.com/";

export interface GoogleAuthOpenResult {
  /** Callback URL carrying `session_id`, when one was captured. */
  url: string | null;
  /** True only when every source (result, hot link, initial URL) came up empty. */
  cancelled: boolean;
}

/** Read `session_id` from hash OR query of a raw URL (Linking.parse can't see the hash). */
export function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?#&]session_id=([^&#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Platform-specific return URL — never hardcoded. */
export function getRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }
  return Linking.createURL("");
}

export function buildAuthUrl(redirectUrl: string): string {
  return `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
}

/** Current web location, if any, so the root can process a fresh callback on mount. */
export function currentWebUrl(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window.location.href;
}

/**
 * Remove ONLY the `session_id` parameter from the web URL (hash and query),
 * preserving everything else. Call this after a SUCCESSFUL exchange.
 */
export function cleanWebSessionId(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const strip = (raw: string, lead: string) => {
    const body = raw.startsWith(lead) ? raw.slice(1) : raw;
    if (!body) return "";
    const kept = body
      .split("&")
      .filter((pair) => pair && !pair.startsWith("session_id="));
    return kept.length ? `${lead}${kept.join("&")}` : "";
  };
  const search = strip(window.location.search, "?");
  const hash = strip(window.location.hash, "#");
  const next = `${window.location.pathname}${search}${hash}`;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Open the Emergent Google auth page.
 * - Web: full-page navigation (never a popup — the return URL would be lost).
 *   The promise resolves with no URL; the root layout picks up `session_id`
 *   after the redirect lands back on `/`.
 * - Mobile: ASWebAuthenticationSession / Chrome Custom Tabs. Android often
 *   reports `dismiss` even after delivering the deep link, so we also listen
 *   for the hot `url` event and check `getInitialURL()` before declaring a
 *   real cancellation.
 */
export async function openGoogleAuth(): Promise<GoogleAuthOpenResult> {
  const redirectUrl = getRedirectUrl();
  const authUrl = buildAuthUrl(redirectUrl);

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.location.href = authUrl;
    return { url: null, cancelled: false };
  }

  let captured: string | null = null;
  const subscription = Linking.addEventListener("url", ({ url }) => {
    if (extractSessionId(url)) captured = url;
  });
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl, {
      preferEphemeralSession: false,
      showInRecents: true,
    });
    if (result.type === "success" && extractSessionId(result.url)) {
      return { url: result.url, cancelled: false };
    }
    // Give the OS a beat to deliver the deep link after the tab closes.
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (captured) return { url: captured, cancelled: false };
    const initial = await Linking.getInitialURL();
    if (extractSessionId(initial)) return { url: initial, cancelled: false };
    return { url: null, cancelled: true };
  } finally {
    subscription.remove();
  }
}
