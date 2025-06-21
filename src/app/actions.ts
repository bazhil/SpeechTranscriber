"use server";

import { SpeechService, RecognitionResult } from '@/lib/sber-salute-speech';
import { formatResultToText } from '@/lib/transcription-formatter';

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
  rawResult?: RecognitionResult;
  error?: string;
}

const speechService = new SpeechService();

export async function initiateTranscriptionAction(
  formData: FormData,
  encoding: string,
  enableSpeakerSeparation: boolean,
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
    
    if ((encoding === 'PCM_S16LE') && (!sampleRate || !channelsCount)) {
        console.error(`[ACTION] Missing parameters for ${encoding}.`);
        return { success: false, error: `For ${encoding} encoding, Sample Rate and Channels Count are required.` };
    }

    console.log('[ACTION] Uploading file for recognition...');
    const uploadResponse = await speechService.uploadFileForRecognition(fileBuffer, file.type);
    if (!uploadResponse.result || !uploadResponse.result.request_file_id) {
      console.error('[ACTION] Failed to upload file to the speech API.', uploadResponse);
      return { success: false, error: 'Failed to upload file to the speech API.' };
    }
    console.log(`[ACTION] File uploaded successfully. Request File ID: ${uploadResponse.result.request_file_id}`);

    console.log('[ACTION] Starting recognition task...');
    const recognitionResponse = await speechService.startRecognition(
      uploadResponse.result.request_file_id,
      encoding,
      sampleRate,
      channelsCount,
      enableSpeakerSeparation
    );

    if (!recognitionResponse.result || !recognitionResponse.result.id) {
      console.error('[ACTION] Failed to initiate transcription task.', recognitionResponse);
      return { success: false, error: 'Failed to initiate transcription task with the speech API.' };
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
    const statusResponse = await speechService.getRecognitionStatus(taskId);
    if (!statusResponse.result) {
      console.error('[ACTION] Invalid status response from speech API.', statusResponse);
      return { success: false, error: 'Invalid status response from the speech API.' };
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
    const rawResult = await speechService.getRecognitionResult(responseFileId);
    console.log(`[ACTION] Received raw result for ${responseFileId}.`);
    
    console.log('[ACTION] Formatting raw result...');
    const formattedText = formatResultToText(rawResult, separateSpeakers);
    console.log(`[ACTION] Formatting complete. Text length: ${formattedText.length}`);
    
    return {
      success: true,
      transcription: formattedText,
      rawResult: rawResult
    };
  } catch (error: any) {
    console.error(`[ACTION ERROR] Error in fetchTranscriptionResultInternal for Response File ID ${responseFileId}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred while fetching transcription result.' };
  }
}
