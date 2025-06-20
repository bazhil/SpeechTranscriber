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
  try {
    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No file uploaded.' };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
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
        return { success: false, error: `For ${encoding} encoding, Sample Rate and Channels Count are required.` };
    }

    const uploadResponse = await sberService.uploadFileForRecognition(fileBuffer, file.type);
    if (!uploadResponse.result || !uploadResponse.result.request_file_id) {
      return { success: false, error: 'Failed to upload file to Sber API.' };
    }

    const recognitionResponse = await sberService.startRecognition(
      uploadResponse.result.request_file_id,
      encoding,
      sampleRate,
      channelsCount,
      enableSpeakerSeparation
    );

    if (!recognitionResponse.result || !recognitionResponse.result.id) {
      return { success: false, error: 'Failed to initiate transcription task with Sber API.' };
    }

    return { success: true, taskId: recognitionResponse.result.id };
  } catch (error: any) {
    console.error('Error in initiateTranscriptionAction:', error);
    return { success: false, error: error.message || 'An unknown error occurred during transcription initiation.' };
  }
}

export async function getTranscriptionStatusInternal(taskId: string): Promise<CheckStatusResponse> {
  try {
    const statusResponse = await sberService.getRecognitionStatus(taskId);
    if (!statusResponse.result) {
      return { success: false, error: 'Invalid status response from Sber API.' };
    }
    
    return {
      success: true,
      status: statusResponse.result.status,
      responseFileId: statusResponse.result.response_file_id,
      errorDetails: statusResponse.result.status === 'ERROR' ? statusResponse.result.error : undefined,
    };
  } catch (error: any) {
    console.error('Error in getTranscriptionStatusInternal:', error);
    return { success: false, error: error.message || 'An unknown error occurred while checking status.' };
  }
}

export async function fetchTranscriptionResultInternal(responseFileId: string, separateSpeakers: boolean): Promise<FetchResultResponse> {
  try {
    const rawResult = await sberService.getRecognitionResult(responseFileId);
    const formattedText = formatSberResultToText(rawResult, separateSpeakers);
    
    return {
      success: true,
      transcription: formattedText,
      rawResult: rawResult // Optionally return raw result for debugging or advanced use
    };
  } catch (error: any) {
    console.error('Error in fetchTranscriptionResultInternal:', error);
    return { success: false, error: error.message || 'An unknown error occurred while fetching transcription result.' };
  }
}
