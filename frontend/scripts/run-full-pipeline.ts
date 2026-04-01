/**
 * Full pipeline E2E (no HTTP): upload video to Storage → insert lecture → processLecturePipeline.
 *
 *   cd frontend
 *   npx tsx scripts/run-full-pipeline.ts "C:\path\to\video.mp4" --email you@example.com
 *
 * Requires .env.local with SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, and Gemini/Vertex vars.
 */
import "./load-env-local";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { basename } from "path";
import { randomUUID } from "crypto";
import { processLecturePipeline } from "../src/lib/server/pipeline";
import { getSupabase } from "../src/lib/server/supabase";

function parseArgs() {
  const argv = process.argv.slice(2);
  let email: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) {
      email = argv[++i];
    } else if (!argv[i].startsWith("-")) {
      positional.push(argv[i]);
    }
  }
  return { videoPath: positional[0], email: email ?? process.env.E2E_PIPELINE_USER_EMAIL };
}

async function findUserIdByEmail(sb: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error("listUsers:", error.message);
    return null;
  }
  const users = data?.users ?? [];
  const u = users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  return u?.id ?? null;
}

async function main() {
  const { videoPath, email } = parseArgs();
  if (!videoPath || !existsSync(videoPath)) {
    console.error('Usage: npx tsx scripts/run-full-pipeline.ts "<path-to-video.mp4>" --email user@example.com');
    process.exit(1);
  }
  if (!email) {
    console.error("Set --email or E2E_PIPELINE_USER_EMAIL to an existing Supabase Auth user.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userId = await findUserIdByEmail(sb, email);
  if (!userId) {
    console.error("No auth user found for email:", email);
    process.exit(1);
  }

  const buf = await readFile(videoPath);
  const safeName = basename(videoPath).replace(/[^a-zA-Z0-9._-]/g, "_") || "lecture.mp4";
  const lectureId = randomUUID();
  const storagePath = `lectures/${lectureId}/${safeName}`;

  console.log("[e2e] Uploading to storage…", storagePath, `(${(buf.length / 1024 / 1024).toFixed(1)} MB)`);

  const { error: upAudio } = await sb.storage.from("audio").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (upAudio) {
    console.error("audio bucket upload:", upAudio.message);
    process.exit(1);
  }

  const { error: upVid } = await sb.storage.from("videos").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (upVid) {
    console.error("videos bucket upload:", upVid.message);
    process.exit(1);
  }

  const { data: pubAudio } = sb.storage.from("audio").getPublicUrl(storagePath);
  const { data: pubVid } = sb.storage.from("videos").getPublicUrl(storagePath);
  const audioUrl = pubAudio.publicUrl;
  const videoUrl = pubVid.publicUrl;

  const { data: row, error: insErr } = await sb
    .from("lectures")
    .insert({
      id: lectureId,
      title: `E2E pipeline ${new Date().toISOString()}`,
      audio_url: audioUrl,
      video_url: videoUrl,
      status: "uploaded",
      compliance_mode: "clean",
      user_id: userId,
    })
    .select("id")
    .single();

  if (insErr || !row) {
    console.error("lectures insert:", insErr?.message);
    process.exit(1);
  }

  console.log("[e2e] Lecture", lectureId, "— running processLecturePipeline (this may take many minutes)…");

  await processLecturePipeline(lectureId);

  const poll = getSupabase();
  const { data: lec } = await poll.from("lectures").select("status, progress_pct, progress_message").eq("id", lectureId).single();
  const st = lec?.status;
  const { count: capCount } = await poll.from("captions").select("*", { count: "exact", head: true }).eq("lecture_id", lectureId);
  const { count: scoreCount } = await poll
    .from("accessibility_scores")
    .select("*", { count: "exact", head: true })
    .eq("lecture_id", lectureId);

  console.log("[e2e] Final status:", st, lec?.progress_pct ?? 0, "%", lec?.progress_message ?? "");
  console.log("[e2e] Captions rows:", capCount ?? 0);
  console.log("[e2e] Accessibility scores rows:", scoreCount ?? 0);

  if (st === "failed") {
    process.exit(1);
  }
  if (st !== "completed") {
    console.error("[e2e] Unexpected status:", st);
    process.exit(1);
  }
  console.log("[e2e] OK — full pipeline finished.");
}

main().catch((e) => {
  console.error("[e2e] Fatal:", e);
  process.exit(1);
});
