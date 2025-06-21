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
  result.forEach((segment: RecognitionResultSegment, index: number) => {
    if (segment.results && Array.isArray(segment.results)) {
      segment.results.forEach((transcription, subIndex) => {
        let line = "";
        // Assuming speaker_tag is at the segment level, apply it once per segment
        if (separateSpeakers && segment.speaker_info && segment.speaker_info.speaker_id !== undefined) {
           line += `Speaker ${segment.speaker_info.speaker_id}: `;
        }
        line += transcription.normalized_text || transcription.text || "";
        fullText += line + "\n";
      });
    } else { console.warn(`[FORMATTER] Segment ${index + 1} has no 'results' array or it's not an array.`); }
    console.log(`[FORMATTER] Processed segment ${index + 1}/${result.length}`);
  });
  
  console.log('[FORMATTER] Formatting complete.');
  return fullText.trim();
}
