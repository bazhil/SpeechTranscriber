
import { v4 as uuidv4 } from 'uuid';
import { saluteSpeechConfig, type SaluteSpeechConfig } from '@/config/settings';

interface SberToken {
  access_token: string;
  expires_at: number; // milliseconds
}

interface UploadFileResponse {
  result: {
    request_file_id: string;
    // ... other potential fields
  };
}

interface StartRecognitionRequestOptions {
  model?: string;
  audio_encoding: string;
  sample_rate?: number;
  hints?: any; // Consider defining a more specific type if hints structure is known
  channels_count?: number;
  speaker_separation_options?: {
    enable: boolean;
    enable_only_main_speaker?: boolean;
    count?: number;
  };
}

interface StartRecognitionRequest {
  options: StartRecognitionRequestOptions;
  request_file_id: string;
}

interface StartRecognitionResponse {
  result: {
    id: string; // Task ID
    // ... other potential fields
  };
}

interface RecognitionStatusResponse {
  result: {
    id: string;
    status: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
    error?: string; // Error description if status is ERROR
    response_file_id?: string; // Available when status is DONE
    // ... other potential fields
  };
}

// Define structure based on Sber API documentation for async results
export interface SberWord {
  text: string;
  start_ms: number;
  end_ms: number;
  speaker_tag?: string; // e.g., "1", "2"
  // confidence might be here or in a parent object
}

export interface SberRecognitionResultSegment {
  text: string; // Full text of the segment
  normalized_text: string; // Normalized text
  start_ms: number;
  end_ms: number;
  speaker_tag?: string;
  channel_tag?: string;
  words: SberWord[];
}

export type SberRecognitionResult = SberRecognitionResultSegment[];


async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SaluteSpeechService {
  private token: SberToken | null = null;
  private sessionId: string;
  private config: SaluteSpeechConfig;

  constructor() {
    this.sessionId = uuidv4();
    this.config = saluteSpeechConfig;
    console.log(`[SBER_SERVICE] New instance created with Session ID: ${this.sessionId}`);
  }

  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
    try {
      console.log(`[SBER_SERVICE] Fetching ${url}, attempt ${attempt}...`);
      const response = await fetch(url, options);
      if (!response.ok && this.config.retryStatuses.includes(response.status) && attempt <= this.config.retryAttempts) {
        const delayTime = this.config.retryTimeout * Math.pow(2, attempt - 1);
        console.warn(`[SBER_SERVICE] Request to ${url} failed with status ${response.status}. Retrying in ${delayTime}ms... (Attempt ${attempt}/${this.config.retryAttempts})`);
        await delay(delayTime); // Exponential backoff
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      if(response.ok) {
        console.log(`[SBER_SERVICE] Fetch successful for ${url} with status ${response.status}.`);
      } else {
        console.warn(`[SBER_SERVICE] Fetch for ${url} completed with non-retryable error status ${response.status}.`);
      }
      return response;
    } catch (error) {
      if (attempt <= this.config.retryAttempts) {
        const delayTime = this.config.retryTimeout * Math.pow(2, attempt - 1);
        console.warn(`[SBER_SERVICE] Request to ${url} failed with error. Retrying in ${delayTime}ms... (Attempt ${attempt}/${this.config.retryAttempts})`, error);
        await delay(delayTime);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      console.error(`[SBER_SERVICE] Fetch failed for ${url} after ${this.config.retryAttempts} attempts.`, error);
      throw error;
    }
  }
  
  private async updateAccessToken(): Promise<void> {
    console.log('[SBER_SERVICE] Updating access token...');
    const data = new URLSearchParams();
    data.append('scope', this.config.scope);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': this.sessionId,
      'Authorization': `Basic ${this.config.authKey}`,
    };

    const response = await this.fetchWithRetry(this.config.speechTokenUrl, {
      method: 'POST',
      headers,
      body: data,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[SBER_SERVICE] Failed to update access token.', { status: response.status, body: errorBody });
      throw new Error(`Failed to update access token: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const tokenData = await response.json();
    if (!tokenData.access_token) {
        console.error('[SBER_SERVICE] Access token not found in response from token endpoint.');
        throw new Error('Access token not found in response');
    }

    // Sber returns expires_at in seconds from epoch, convert to ms
    // If it's not present, default to 30 mins (1800000 ms)
    const expiresInMs = tokenData.expires_in ? tokenData.expires_in * 1000 : 1800000;
    this.token = {
        access_token: tokenData.access_token,
        expires_at: Date.now() + expiresInMs,
    };
    console.log(`[SBER_SERVICE] Access token updated successfully. Expires at: ${new Date(this.token.expires_at).toISOString()}`);
  }

  private async getAccessToken(): Promise<string> {
    if (!this.token || this.token.expires_at < Date.now() + this.config.maxWaitTimeToken) {
      console.log('[SBER_SERVICE] Access token is missing or expiring soon. Refreshing...');
      await this.updateAccessToken();
    }
    if (!this.token) { // Should be set by updateAccessToken
        throw new Error('Failed to get or refresh access token.');
    }
    return this.token.access_token;
  }

  async uploadFileForRecognition(fileBuffer: Buffer, contentType: string): Promise<UploadFileResponse> {
    console.log(`[SBER_SERVICE] Uploading file for recognition. Content-Type: ${contentType}`);
    const accessToken = await this.getAccessToken();
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType, // e.g., 'audio/mpeg', 'audio/wav', 'video/mp4'
      'X-Request-ID': this.sessionId,
    };

    const response = await this.fetchWithRetry(`${this.config.speechBaseUrl}/data:upload`, {
      method: 'POST',
      headers,
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[SBER_SERVICE] Failed to upload file.', { status: response.status, body: errorBody });
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    const jsonResponse = await response.json();
    console.log(`[SBER_SERVICE] File upload successful. Request File ID: ${jsonResponse.result.request_file_id}`);
    return jsonResponse;
  }

  async startRecognition(
    requestFileId: string, 
    encoding: string, 
    sampleRate?: number, 
    channelsCount?: number, 
    enableSpeakerSeparation: boolean = true,
    hints?: any
    ): Promise<StartRecognitionResponse> {
    console.log(`[SBER_SERVICE] Starting recognition for Request File ID: ${requestFileId}`);
    const accessToken = await this.getAccessToken();
    
    const options: StartRecognitionRequestOptions = {
      model: 'general', // Default model
      audio_encoding: encoding,
    };

    if (sampleRate) options.sample_rate = sampleRate;
    if (channelsCount) options.channels_count = channelsCount;
    if (hints) options.hints = hints;

    if (enableSpeakerSeparation) {
      options.speaker_separation_options = {
        enable: true,
      };
    }

    const requestBody: StartRecognitionRequest = {
      options,
      request_file_id: requestFileId,
    };

    console.log('[SBER_SERVICE] Recognition request body:', JSON.stringify(requestBody, null, 2));

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Request-ID': this.sessionId,
    };

    const response = await this.fetchWithRetry(`${this.config.speechBaseUrl}/speech:async_recognize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[SBER_SERVICE] Failed to start recognition.', { status: response.status, body: errorBody });
      throw new Error(`Failed to start recognition: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    const jsonResponse = await response.json();
    console.log(`[SBER_SERVICE] Recognition started successfully. Task ID: ${jsonResponse.result.id}`);
    return jsonResponse;
  }

  async getRecognitionStatus(taskId: string): Promise<RecognitionStatusResponse> {
    console.log(`[SBER_SERVICE] Getting recognition status for Task ID: ${taskId}`);
    const accessToken = await this.getAccessToken();
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'X-Request-ID': this.sessionId,
    };

    const response = await this.fetchWithRetry(`${this.config.speechBaseUrl}/task:get?id=${taskId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[SBER_SERVICE] Failed to get recognition status for Task ID: ${taskId}.`, { status: response.status, body: errorBody });
      throw new Error(`Failed to get recognition status: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    const jsonResponse = await response.json();
    console.log(`[SBER_SERVICE] Status for Task ID ${taskId} is: ${jsonResponse.result.status}`);
    return jsonResponse;
  }

  async getRecognitionResult(responseFileId: string): Promise<SberRecognitionResult> {
    console.log(`[SBER_SERVICE] Getting recognition result for Response File ID: ${responseFileId}`);
    const accessToken = await this.getAccessToken();
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'X-Request-ID': this.sessionId,
    };

    const response = await this.fetchWithRetry(`${this.config.speechBaseUrl}/data:download?response_file_id=${responseFileId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[SBER_SERVICE] Failed to get recognition result for Response File ID: ${responseFileId}.`, { status: response.status, body: errorBody });
      throw new Error(`Failed to get recognition result: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    // Sber API might return JSON with non-standard content-type, so parse as text then JSON
    const textBody = await response.text();
    console.log(`[SBER_SERVICE] Successfully downloaded result data for Response File ID: ${responseFileId}. Data size: ${textBody.length}`);
    try {
        const parsedResult = JSON.parse(textBody) as SberRecognitionResult;
        console.log('[SBER_SERVICE] Result data parsed successfully.');
        return parsedResult;
    } catch (e) {
        console.error('[SBER_SERVICE] Failed to parse recognition result JSON.', { error: e, body: textBody });
        throw new Error(`Failed to parse recognition result JSON: ${e}. Received: ${textBody}`);
    }
  }
}
