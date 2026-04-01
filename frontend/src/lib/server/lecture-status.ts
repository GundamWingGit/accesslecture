import { getSupabase } from "./supabase";

export function updateLectureStatus(
  lectureId: string,
  status: string,
  progressPct = 0,
  message = ""
) {
  const sb = getSupabase();
  return sb
    .from("lectures")
    .update({ status, progress_pct: progressPct, progress_message: message })
    .eq("id", lectureId)
    .then(() => {});
}
