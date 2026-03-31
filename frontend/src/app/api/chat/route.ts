import { streamText, tool, stepCountIs } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { config } from "@/lib/server/config";
import { getUserId, AuthError } from "@/lib/server/auth";

export const maxDuration = 120;

function getModel() {
  const authOptions = config.googleCredentialsJson
    ? {
        credentials: (() => {
          const c = JSON.parse(config.googleCredentialsJson);
          return { client_email: c.client_email, private_key: c.private_key };
        })(),
      }
    : undefined;

  const vertex = createVertex({
    project: config.gcpProjectId,
    location: config.gcpLocation,
    googleAuthOptions: authOptions,
  });

  return vertex(config.geminiModel);
}

async function getLectureContext(lectureId: string, userId: string) {
  const sb = getSupabase();
  const { data: lecture } = await sb
    .from("lectures")
    .select("title, duration_seconds, compliance_mode, status")
    .eq("id", lectureId)
    .eq("user_id", userId);

  if (!lecture?.length) return null;

  const { data: captions } = await sb
    .from("captions")
    .select("id, sequence, start_ms, end_ms, original_text, cleaned_text, speaker, min_confidence")
    .eq("lecture_id", lectureId)
    .order("sequence");

  const { data: scores } = await sb
    .from("accessibility_scores")
    .select("overall, rating")
    .eq("lecture_id", lectureId)
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    lecture: lecture[0],
    captionCount: captions?.length ?? 0,
    score: scores?.[0] ?? null,
    captions: captions ?? [],
  };
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await getUserId(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ detail: e.message }, { status: 401 });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }

  const { messages, lectureId } = await request.json();

  if (!lectureId) {
    return NextResponse.json({ detail: "Missing lectureId" }, { status: 400 });
  }

  const ctx = await getLectureContext(lectureId, userId);
  if (!ctx) {
    return NextResponse.json({ detail: "Lecture not found" }, { status: 404 });
  }

  {

    const systemPrompt = `You are an AI assistant for AccessLecture, a tool that makes lecture recordings accessible. You help users edit captions, fix issues, and understand their lecture content.

Current lecture: "${ctx.lecture.title}"
Duration: ${ctx.lecture.duration_seconds ? Math.floor(ctx.lecture.duration_seconds / 60) + " minutes" : "unknown"}
Mode: ${ctx.lecture.compliance_mode}
Total captions: ${ctx.captionCount}
Accessibility score: ${ctx.score ? `${ctx.score.overall}% (${ctx.score.rating})` : "not scored yet"}

You have access to tools that can edit captions, rename speakers, adjust timing, search content, and more. When the user asks you to make changes, use the appropriate tool. Always confirm what you did after making changes.

Be concise and helpful. When referencing captions, mention their sequence number and timestamp.`;

    const sb = getSupabase();

    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
      tools: {
        editCaption: tool({
          description: "Edit the text of a specific caption by its sequence number (1-based)",
          inputSchema: z.object({
            sequence: z.number().describe("Caption sequence number (1-based)"),
            newText: z.string().describe("The new caption text"),
          }),
          execute: async ({ sequence, newText }) => {
            const { data } = await sb
              .from("captions")
              .select("id")
              .eq("lecture_id", lectureId)
              .eq("sequence", sequence);
            if (!data?.length) return { error: `Caption #${sequence} not found` };
            await sb.from("captions").update({ cleaned_text: newText }).eq("id", data[0].id);
            return { success: true, message: `Updated caption #${sequence}` };
          },
        }),

        batchEdit: tool({
          description: "Find and replace text across all captions, or remove filler words",
          inputSchema: z.object({
            find: z.string().describe("Text to find (case-insensitive)"),
            replace: z.string().describe("Replacement text (empty string to delete)"),
          }),
          execute: async ({ find, replace }) => {
            const { data: captions } = await sb
              .from("captions")
              .select("id, cleaned_text, original_text")
              .eq("lecture_id", lectureId);

            let count = 0;
            const regex = new RegExp(find, "gi");
            for (const cap of captions ?? []) {
              const text = cap.cleaned_text || cap.original_text;
              if (regex.test(text)) {
                const updated = text.replace(regex, replace);
                await sb.from("captions").update({ cleaned_text: updated }).eq("id", cap.id);
                count++;
                regex.lastIndex = 0;
              }
            }
            return { success: true, message: `Updated ${count} caption(s)` };
          },
        }),

        renameSpeaker: tool({
          description: "Rename a speaker label across all captions",
          inputSchema: z.object({
            oldName: z.string().describe("Current speaker name"),
            newName: z.string().describe("New speaker name"),
          }),
          execute: async ({ oldName, newName }) => {
            const { data: captions } = await sb
              .from("captions")
              .select("id, speaker, cleaned_text, original_text")
              .eq("lecture_id", lectureId)
              .eq("speaker", oldName);

            if (!captions?.length) return { error: `No captions found with speaker "${oldName}"` };

            for (const cap of captions) {
              const text = cap.cleaned_text || cap.original_text;
              const updated = text.replace(new RegExp(`^>> ${oldName}:`, "i"), `>> ${newName}:`);
              await sb.from("captions").update({ speaker: newName, cleaned_text: updated }).eq("id", cap.id);
            }
            return { success: true, message: `Renamed "${oldName}" to "${newName}" in ${captions.length} caption(s)` };
          },
        }),

        adjustTiming: tool({
          description: "Shift timing of all captions or a range by a given number of milliseconds",
          inputSchema: z.object({
            shiftMs: z.number().describe("Milliseconds to shift (positive = later, negative = earlier)"),
            fromSequence: z.number().optional().describe("Start from this sequence number (inclusive, 1-based)"),
            toSequence: z.number().optional().describe("End at this sequence number (inclusive, 1-based)"),
          }),
          execute: async ({ shiftMs, fromSequence, toSequence }) => {
            let query = sb
              .from("captions")
              .select("id, sequence, start_ms, end_ms")
              .eq("lecture_id", lectureId);

            if (fromSequence) query = query.gte("sequence", fromSequence);
            if (toSequence) query = query.lte("sequence", toSequence);

            const { data: captions } = await query;
            if (!captions?.length) return { error: "No captions found in range" };

            for (const cap of captions) {
              await sb.from("captions").update({
                start_ms: Math.max(0, cap.start_ms + shiftMs),
                end_ms: Math.max(0, cap.end_ms + shiftMs),
              }).eq("id", cap.id);
            }
            return { success: true, message: `Shifted ${captions.length} caption(s) by ${shiftMs}ms` };
          },
        }),

        splitCaption: tool({
          description: "Split a caption into two at a specified word boundary",
          inputSchema: z.object({
            sequence: z.number().describe("Caption sequence number to split"),
            splitAfterWord: z.number().describe("Split after this word index (0-based)"),
          }),
          execute: async ({ sequence, splitAfterWord }) => {
            const { data } = await sb
              .from("captions")
              .select("*")
              .eq("lecture_id", lectureId)
              .eq("sequence", sequence);

            if (!data?.length) return { error: `Caption #${sequence} not found` };
            const cap = data[0];
            const text = cap.cleaned_text || cap.original_text;
            const words = text.split(/\s+/);

            if (splitAfterWord < 0 || splitAfterWord >= words.length - 1) {
              return { error: "Invalid split position" };
            }

            const text1 = words.slice(0, splitAfterWord + 1).join(" ");
            const text2 = words.slice(splitAfterWord + 1).join(" ");
            const midMs = Math.round(cap.start_ms + ((cap.end_ms - cap.start_ms) * (splitAfterWord + 1)) / words.length);

            await sb.from("captions").update({
              cleaned_text: text1,
              end_ms: midMs,
            }).eq("id", cap.id);

            await sb.from("captions")
              .update({ sequence: sequence + 1 })
              .eq("lecture_id", lectureId)
              .gt("sequence", sequence);

            await sb.from("captions").insert({
              lecture_id: lectureId,
              sequence: sequence + 1,
              start_ms: midMs,
              end_ms: cap.end_ms,
              original_text: text2,
              cleaned_text: text2,
              speaker: cap.speaker,
              min_confidence: cap.min_confidence,
            });

            return { success: true, message: `Split caption #${sequence} into two parts` };
          },
        }),

        mergeCaptions: tool({
          description: "Merge two adjacent captions into one",
          inputSchema: z.object({
            sequence: z.number().describe("First caption sequence number (will merge with the next one)"),
          }),
          execute: async ({ sequence }) => {
            const { data } = await sb
              .from("captions")
              .select("*")
              .eq("lecture_id", lectureId)
              .in("sequence", [sequence, sequence + 1])
              .order("sequence");

            if (!data || data.length < 2) return { error: "Could not find two adjacent captions" };

            const [first, second] = data;
            const mergedText = `${first.cleaned_text || first.original_text} ${second.cleaned_text || second.original_text}`;

            await sb.from("captions").update({
              cleaned_text: mergedText,
              end_ms: second.end_ms,
            }).eq("id", first.id);

            await sb.from("captions").delete().eq("id", second.id);

            return { success: true, message: `Merged captions #${sequence} and #${sequence + 1}` };
          },
        }),

        searchContent: tool({
          description: "Search for specific words or topics in the captions",
          inputSchema: z.object({
            query: z.string().describe("Search query (words or phrase to find)"),
          }),
          execute: async ({ query: q }) => {
            const { data: captions } = await sb
              .from("captions")
              .select("sequence, start_ms, end_ms, cleaned_text, original_text, speaker")
              .eq("lecture_id", lectureId)
              .order("sequence");

            const regex = new RegExp(q, "gi");
            const matches = (captions ?? []).filter((c) => {
              const text = c.cleaned_text || c.original_text;
              const found = regex.test(text);
              regex.lastIndex = 0;
              return found;
            }).map((c) => ({
              sequence: c.sequence,
              time: `${Math.floor(c.start_ms / 60000)}:${String(Math.floor((c.start_ms % 60000) / 1000)).padStart(2, "0")}`,
              speaker: c.speaker,
              text: (c.cleaned_text || c.original_text).slice(0, 100),
            }));

            return { matches, total: matches.length };
          },
        }),

        summarizeLecture: tool({
          description: "Get a summary of the lecture content based on captions",
          inputSchema: z.object({}),
          execute: async () => {
            const { data: captions } = await sb
              .from("captions")
              .select("cleaned_text, original_text, speaker")
              .eq("lecture_id", lectureId)
              .order("sequence");

            const fullText = (captions ?? [])
              .map((c) => c.cleaned_text || c.original_text)
              .join(" ")
              .slice(0, 10000);

            return {
              captionCount: captions?.length ?? 0,
              speakers: [...new Set((captions ?? []).map((c) => c.speaker).filter(Boolean))],
              textPreview: fullText,
            };
          },
        }),

        getLectureStats: tool({
          description: "Get current stats about the lecture: accessibility score, caption count, speakers, duration",
          inputSchema: z.object({}),
          execute: async () => {
            return {
              title: ctx.lecture.title,
              duration: ctx.lecture.duration_seconds,
              captionCount: ctx.captionCount,
              score: ctx.score,
              mode: ctx.lecture.compliance_mode,
            };
          },
        }),
      },
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  }
}
