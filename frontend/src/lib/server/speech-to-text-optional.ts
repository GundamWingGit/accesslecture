import { config } from "./config";

/**
 * Tier B (future): Google Cloud Speech-to-Text batch / long-running as primary transcript,
 * Gemini only for cleanup. Not wired — see Cloud batch recognize docs.
 */
export function assertGeminiTranscriptionEnabled(): void {
  if (config.speechToTextPrimary) {
    throw new Error(
      "SPEECH_TO_TEXT_PRIMARY=true is not implemented. " +
        "Use Gemini (default) or implement Speech-to-Text v2 batch in this module and pipeline."
    );
  }
}
