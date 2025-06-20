import type { SberRecognitionResult, SberRecognitionResultSegment } from './sber-salute-speech';

export function formatSberResultToText(sberResult: SberRecognitionResult, separateSpeakers: boolean): string {
  if (!sberResult || !Array.isArray(sberResult)) {
    console.error("Invalid Sber result format or no results:", sberResult);
    return "Error: Invalid result format or no results.";
  }

  if (sberResult.length === 0) {
    return "No transcription results found.";
  }

  let fullText = "";
  sberResult.forEach((segment: SberRecognitionResultSegment) => {
    let line = "";
    if (separateSpeakers && segment.speaker_tag) {
      line += `Speaker ${segment.speaker_tag}: `;
    }
    // Use normalized_text if available, otherwise fallback to text
    line += segment.normalized_text || segment.text || "";
    fullText += line + "\n";
  });
  
  return fullText.trim();
}
