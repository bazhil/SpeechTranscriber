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
  let lastLine = ""; // To track the previous line for duplicate check
  result.forEach((segment: RecognitionResultSegment, index: number) => {
    // Skip segments with speaker_id -1 and only include speakers 1 and 2
    if (segment.speaker_info && (segment.speaker_info.speaker_id === 1 || segment.speaker_info.speaker_id === 2)) {
      if (segment.results && Array.isArray(segment.results)) {
        segment.results.forEach((transcription, subIndex) => {
          let line = "";
          // Add speaker label if separateSpeakers is true
          if (separateSpeakers) {
             line += `Speaker ${segment.speaker_info.speaker_id}: `;
          }
          const text = transcription.normalized_text || transcription.text || "";
          line += text;

          // Prevent adding fully duplicated replicas consecutively
          if (line.trim() !== lastLine.trim()) {
            fullText += line + "\n";
            lastLine = line;
          }
        });
      } else { console.warn(`[FORMATTER] Segment ${index + 1} has no 'results' array or it's not an array.`); }
    } else if (segment.speaker_info && segment.speaker_info.speaker_id !== undefined) {
       console.log(`[FORMATTER] Skipping segment ${index + 1} with speaker_id: ${segment.speaker_info.speaker_id}`);
    }
    console.log(`[FORMATTER] Processed segment ${index + 1}/${result.length}`);
  });
  
  console.log('[FORMATTER] Formatting complete.');
  return fullText.trim();
}
