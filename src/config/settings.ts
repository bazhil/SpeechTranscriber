
export interface SpeechServiceConfig {
  authKey: string;
  speechTokenUrl: string;
  speechBaseUrl: string;
  scope: string;
  retryAttempts: number;
  retryTimeout: number; // ms
  maxWaitTimeToken: number; // ms, for token expiry check buffer
  recognitionPollingDelay: number; // ms
  retryStatuses: number[];
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function getEnvVarAsInt(key: string, defaultValue?: number): number {
    const valueStr = getEnvVar(key, defaultValue !== undefined ? String(defaultValue) : undefined);
    const valueInt = parseInt(valueStr, 10);
    if (isNaN(valueInt)) {
        throw new Error(`Environment variable ${key} is not a valid integer: ${valueStr}`);
    }
    return valueInt;
}


export const speechServiceConfig: SpeechServiceConfig = {
  authKey: getEnvVar('SPEECH_API_AUTH_KEY'),
  speechTokenUrl: getEnvVar('SPEECH_API_TOKEN_URL', 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'),
  speechBaseUrl: getEnvVar('SPEECH_API_BASE_URL', 'https://smartspeech.sber.ru/rest/v1'),
  scope: 'SALUTE_SPEECH_PERS',
  retryAttempts: getEnvVarAsInt('RETRY_ATTEMPTS', 5),
  retryTimeout: getEnvVarAsInt('RETRY_TIMEOUT', 2) * 1000, 
  maxWaitTimeToken: getEnvVarAsInt('MAX_WAIT_TIME', 300000), 
  recognitionPollingDelay: getEnvVarAsInt('RECOGNITION_POLLING_DELAY', 1000),
  retryStatuses: [429, 500, 502, 503, 504],
};
