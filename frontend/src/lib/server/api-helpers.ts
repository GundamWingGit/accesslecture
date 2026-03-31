import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUserIdFromToken, AuthError } from "./auth";
import { getSupabase } from "./supabase";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(detail: string, status: number) {
  return NextResponse.json({ detail }, { status });
}

export async function withAuth(
  request: NextRequest,
  handler: (userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const userId = await getUserId(request);
    return await handler(userId);
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.message, 401);
    }
    console.error("Unhandled error:", e);
    return error("Internal server error", 500);
  }
}

export async function withTokenAuth(
  token: string,
  handler: (userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromToken(token);
    return await handler(userId);
  } catch (e) {
    if (e instanceof AuthError) {
      return error(e.message, 401);
    }
    console.error("Unhandled error:", e);
    return error("Internal server error", 500);
  }
}

export async function verifyLectureOwnership(
  lectureId: string,
  userId: string
): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from("lectures")
    .select("id")
    .eq("id", lectureId)
    .eq("user_id", userId);
  return !!data?.length;
}
