import type { SberRecognitionResult, SberRecognitionResultSegment } from './sber-salute-speech';

export function formatSberResultToText(sberResult: SberRecognitionResult, separateSpeakers: boolean): string {
  console.log('[FORMATTER] Formatting Sber result to text. Separate speakers:', separateSpeakers);
  if (!sberResult || !Array.isArray(sberResult)) {
    console.error("[FORMATTER] Invalid Sber result format or no results:", sberResult);
    return "Error: Invalid result format or no results.";
  }

  if (sberResult.length === 0) {
    console.log("[FORMATTER] No transcription results found in the data.");
    return "No transcription results found.";
  }

  let fullText = "";
  sberResult.forEach((segment: SberRecognitionResultSegment, index) => {
    let line = "";
    if (separateSpeakers && segment.speaker_tag) {
      line += `Speaker ${segment.speaker_tag}: `;
    }
    // Use normalized_text if available, otherwise fallback to text
    line += segment.normalized_text || segment.text || "";
    fullText += line + "\n";
    console.log(`[FORMATTER] Processed segment ${index + 1}/${sberResult.length}`);
  });
  
  console.log('[FORMATTER] Formatting complete.');
  return fullText.trim();
}
