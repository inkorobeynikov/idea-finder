import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: Do NOT run code between createServerClient and getClaims().
  // getClaims() refreshes the auth token; skipping it can randomly log users out.
  // Always use getClaims()/getUser() — never trust getSession() server-side.
  await supabase.auth.getClaims();

  // IMPORTANT: return supabaseResponse as-is so the refreshed auth cookies are
  // preserved. If you create a new response, copy over supabaseResponse.cookies.
  return supabaseResponse;
}
