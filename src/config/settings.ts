export interface SaluteSpeechConfig {
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


export const saluteSpeechConfig: SaluteSpeechConfig = {
  authKey: getEnvVar('SBER_AUTH_KEY'),
  speechTokenUrl: getEnvVar('SBER_SPEECH_TOKEN_URL', 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'),
  speechBaseUrl: getEnvVar('SBER_SPEECH_BASE_URL', 'https://smartspeech.sber.ru/rest/v1'),
  scope: 'SALUTE_SPEECH_PERS',
  retryAttempts: getEnvVarAsInt('SBER_RETRY_ATTEMPTS', 3),
  retryTimeout: getEnvVarAsInt('SBER_RETRY_TIMEOUT', 1000), // 1 second
  maxWaitTimeToken: getEnvVarAsInt('SBER_MAX_WAIT_TIME_TOKEN', 10000), // 10 seconds buffer for token expiry
  recognitionPollingDelay: getEnvVarAsInt('SBER_RECOGNITION_POLLING_DELAY', 5000), // 5 seconds
  retryStatuses: [429, 500, 502, 503, 504], // Status codes to retry on
};
