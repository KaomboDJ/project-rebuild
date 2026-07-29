import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/auth/error?code=callback-invalid", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/error?code=callback-failed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
