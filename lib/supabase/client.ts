import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local")
  }

  // If the URL uses plain HTTP, convert to HTTPS to avoid mixed-content failures
  // when the app is served over HTTPS (browsers block insecure fetches).
  if (url.startsWith("http://")) {
    // eslint-disable-next-line no-console
    console.warn("Supabase URL uses http; converting to https to avoid mixed-content errors.")
    url = url.replace(/^http:\/\//i, "https://")
  }

  return createBrowserClient(url, key)
}
