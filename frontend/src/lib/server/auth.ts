import { NextRequest } from "next/server";
import { getSupabase } from "./supabase";

export async function getUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid authorization header");
  }

  const token = authHeader.slice(7).trim();
  if (!token) throw new AuthError("Empty token");

  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) throw new AuthError("Invalid token");
    return data.user.id;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("Authentication failed");
  }
}

export async function getUserIdFromToken(token: string): Promise<string> {
  if (!token) throw new AuthError("Missing token");
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new AuthError("Invalid token");
  return data.user.id;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
