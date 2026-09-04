import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    const noOpError = { message: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local." }

    return {
      auth: {
        resetPasswordForEmail: async () => ({ data: null, error: noOpError }),
        signInWithPassword: async () => ({ data: { user: null }, error: noOpError }),
        signUp: async () => ({ data: { user: null, session: null }, error: noOpError }),
        getSession: async () => ({ data: { session: null }, error: noOpError }),
        getUser: async () => ({ data: { user: null }, error: noOpError }),
        updateUser: async () => ({ data: { user: null }, error: noOpError }),
        setSession: async () => ({ data: { session: null }, error: noOpError }),
        exchangeCodeForSession: async () => ({ data: { session: null }, error: noOpError }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: noOpError }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: async () => ({ data: null, error: noOpError }),
          }),
        }),
        insert: () => ({
          select: async () => ({ data: null, error: noOpError }),
        }),
        delete: () => ({
          eq: () => ({
            select: async () => ({ data: null, error: noOpError }),
          }),
        }),
      }),
    } as any
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
