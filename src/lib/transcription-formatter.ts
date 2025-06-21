import type { RecognitionResult, RecognitionResultSegment } from './sber-salute-speech';

export function formatResultToText(result: RecognitionResult, separateSpeakers: boolean): string {
  console.log('[FORMATTER] Formatting result to text. Separate speakers:', separateSpeakers);
  if (!result || !Array.isArray(result)) {
    console.error("[FORMATTER] Invalid result format or no results:", result);
    return "Error: Invalid result format or no results.";
  }

  if (result.length === 0) {
    console.log("[FORMATTER] No transcription results found in the data.");
    return "No transcription results found.";
  }

  let fullText = "";
  result.forEach((segment: RecognitionResultSegment, index) => {
    let line = "";
    if (separateSpeakers && segment.speaker_tag) {
      line += `Speaker ${segment.speaker_tag}: `;
    }
    line += segment.normalized_text || segment.text || "";
    fullText += line + "\n";
    console.log(`[FORMATTER] Processed segment ${index + 1}/${result.length}`);
  });
  
  console.log('[FORMATTER] Formatting complete.');
  return fullText.trim();
}
