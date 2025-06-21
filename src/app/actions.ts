"use server";

import { SaluteSpeechService, SberRecognitionResult } from '@/lib/sber-salute-speech';
import { formatSberResultToText } from '@/lib/transcription-formatter';
// To install music-metadata: npm install music-metadata
// import * as mm from 'music-metadata'; // Uncomment if using music-metadata

interface InitiateTranscriptionResponse {
  success: boolean;
  taskId?: string;
  error?: string;
}

interface CheckStatusResponse {
  success: boolean;
  status?: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
  responseFileId?: string;
  error?: string;
  errorDetails?: string;
}

interface FetchResultResponse {
  success: boolean;
  transcription?: string;
  rawResult?: SberRecognitionResult;
  error?: string;
}

const sberService = new SaluteSpeechService();

export async function initiateTranscriptionAction(
  formData: FormData,
  encoding: string,
  enableSpeakerSeparation: boolean,
  // Optional params, as Sber API can auto-detect for some formats
  sampleRate?: number, 
  channelsCount?: number
): Promise<InitiateTranscriptionResponse> {
  console.log('[ACTION] Initiating transcription...');
  try {
    const file = formData.get('file') as File | null;
    if (!file) {
      console.error('[ACTION] No file uploaded.');
      return { success: false, error: 'No file uploaded.' };
    }
    console.log(`[ACTION] File received: ${file.name}, size: ${file.size}, type: ${file.type}`);

    console.log('[ACTION] Creating file buffer...');
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log('[ACTION] File buffer created.');
    
    // Example: Using music-metadata to get metadata if needed and not provided
    // This part is commented out to reduce initial complexity and dependencies.
    // Enable if precise metadata is required for all formats and not auto-detected by Sber.
    /*
    if (!sampleRate || !channelsCount) {
      try {
        const metadata = await mm.parseBuffer(fileBuffer, file.type);
        if (!sampleRate && metadata.format.sampleRate) {
          sampleRate = metadata.format.sampleRate;
        }
        if (!channelsCount && metadata.format.numberOfChannels) {
          channelsCount = metadata.format.numberOfChannels;
        }
      } catch (metaError) {
        console.warn("Could not parse audio metadata:", metaError);
        // Decide if this is critical. For some Sber encodings, these are mandatory.
        // For now, we proceed, Sber might auto-detect or fail.
      }
    }
    */

    // Ensure critical parameters for certain encodings are present
    if ((encoding === 'PCM_S16LE' || encoding === 'SBER_PCM_S16LE') && (!sampleRate || !channelsCount)) {
        console.error(`[ACTION] Missing parameters for ${encoding}.`);
        return { success: false, error: `For ${encoding} encoding, Sample Rate and Channels Count are required.` };
    }

    console.log('[ACTION] Uploading file for recognition...');
    const uploadResponse = await sberService.uploadFileForRecognition(fileBuffer, file.type);
    if (!uploadResponse.result || !uploadResponse.result.request_file_id) {
      console.error('[ACTION] Failed to upload file to Sber API.', uploadResponse);
      return { success: false, error: 'Failed to upload file to Sber API.' };
    }
    console.log(`[ACTION] File uploaded successfully. Request File ID: ${uploadResponse.result.request_file_id}`);

    console.log('[ACTION] Starting recognition task...');
    const recognitionResponse = await sberService.startRecognition(
      uploadResponse.result.request_file_id,
      encoding,
      sampleRate,
      channelsCount,
      enableSpeakerSeparation
    );

    if (!recognitionResponse.result || !recognitionResponse.result.id) {
      console.error('[ACTION] Failed to initiate transcription task.', recognitionResponse);
      return { success: false, error: 'Failed to initiate transcription task with Sber API.' };
    }
    console.log(`[ACTION] Transcription task started successfully. Task ID: ${recognitionResponse.result.id}`);

    return { success: true, taskId: recognitionResponse.result.id };
  } catch (error: any) {
    console.error('[ACTION ERROR] Error in initiateTranscriptionAction:', error);
    return { success: false, error: error.message || 'An unknown error occurred during transcription initiation.' };
  }
}

export async function getTranscriptionStatusInternal(taskId: string): Promise<CheckStatusResponse> {
  console.log(`[ACTION] Checking transcription status for Task ID: ${taskId}`);
  try {
    const statusResponse = await sberService.getRecognitionStatus(taskId);
    if (!statusResponse.result) {
      console.error('[ACTION] Invalid status response from Sber API.', statusResponse);
      return { success: false, error: 'Invalid status response from Sber API.' };
    }
    console.log(`[ACTION] Status for Task ID ${taskId}: ${statusResponse.result.status}`);
    
    return {
      success: true,
      status: statusResponse.result.status,
      responseFileId: statusResponse.result.response_file_id,
      errorDetails: statusResponse.result.status === 'ERROR' ? statusResponse.result.error : undefined,
    };
  } catch (error: any) {
    console.error(`[ACTION ERROR] Error in getTranscriptionStatusInternal for Task ID ${taskId}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred while checking status.' };
  }
}

export async function fetchTranscriptionResultInternal(responseFileId: string, separateSpeakers: boolean): Promise<FetchResultResponse> {
  console.log(`[ACTION] Fetching transcription result for Response File ID: ${responseFileId}`);
  try {
    const rawResult = await sberService.getRecognitionResult(responseFileId);
    console.log(`[ACTION] Received raw result for ${responseFileId}.`);
    
    console.log('[ACTION] Formatting raw result...');
    const formattedText = formatSberResultToText(rawResult, separateSpeakers);
    console.log(`[ACTION] Formatting complete. Text length: ${formattedText.length}`);
    
    return {
      success: true,
      transcription: formattedText,
      rawResult: rawResult // Optionally return raw result for debugging or advanced use
    };
  } catch (error: any) {
    console.error(`[ACTION ERROR] Error in fetchTranscriptionResultInternal for Response File ID ${responseFileId}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred while fetching transcription result.' };
  }
}
