// Twilio Integration Service - Replit Connector
import twilio from 'twilio';

let connectionSettings: any;
let credentialsCache: {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
  cachedAt: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000;

const RETRYABLE_ERROR_CODES = [
  20003,
  20429,
  20500,
  20503,
  30001,
  30002,
  30003,
  30004,
  30005,
];

const PERMANENT_ERROR_CODES = [
  21211,
  21214,
  21217,
  21219,
  21408,
  21610,
  21612,
  21614,
];

interface TwilioError extends Error {
  code?: number;
  status?: number;
  moreInfo?: string;
}

async function getCredentials() {
  if (credentialsCache && Date.now() - credentialsCache.cachedAt < CACHE_TTL) {
    return credentialsCache;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  
  credentialsCache = {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number,
    cachedAt: Date.now()
  };
  
  return credentialsCache;
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

function isRetryableError(error: TwilioError): boolean {
  if (error.code && PERMANENT_ERROR_CODES.includes(error.code)) {
    return false;
  }
  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }
  if (error.status && error.status >= 500) {
    return true;
  }
  if (error.message?.includes('ETIMEDOUT') || 
      error.message?.includes('ECONNRESET') ||
      error.message?.includes('ECONNREFUSED')) {
    return true;
  }
  return false;
}

function getErrorMessage(error: TwilioError): string {
  const errorMessages: Record<number, string> = {
    21211: 'Invalid phone number format',
    21214: 'Phone number is not a valid mobile number',
    21217: 'Phone number is not a valid SMS-capable number',
    21219: 'Phone number belongs to a blocked country',
    21408: 'Account does not have permission to send to this number',
    21610: 'Message cannot be sent to an opted-out number',
    21612: 'The "To" phone number is not a valid mobile number',
    21614: 'Invalid phone number format for region',
    30001: 'Message queue full, please retry',
    30002: 'Account suspended',
    30003: 'Unreachable destination',
    30004: 'Message blocked',
    30005: 'Unknown destination',
  };

  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }
  
  return error.message || 'Failed to send SMS';
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: TwilioError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Twilio SMS attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

export interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  errorCode?: number;
  isRetryable?: boolean;
}

export async function sendSignatureSMS(
  toPhoneNumber: string,
  signatureUrl: string,
  clientName: string,
  storeName: string,
  type: 'dropoff' | 'pickup',
  language: 'en' | 'pt-BR' = 'en'
): Promise<SMSResult> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();

    const messages = {
      'dropoff': {
        'en': `Hi ${clientName}! ${storeName} needs your signature to authorize the repair service. Please sign here: ${signatureUrl}`,
        'pt-BR': `Olá ${clientName}! ${storeName} precisa da sua assinatura para autorizar o serviço de reparo. Por favor, assine aqui: ${signatureUrl}`
      },
      'pickup': {
        'en': `Hi ${clientName}! Your device is ready for pickup at ${storeName}. Please sign to confirm receipt: ${signatureUrl}`,
        'pt-BR': `Olá ${clientName}! Seu dispositivo está pronto para retirada em ${storeName}. Por favor, assine para confirmar o recebimento: ${signatureUrl}`
      }
    };

    const messageBody = messages[type][language] || messages[type]['en'];

    const message = await sendWithRetry(async () => {
      return await client.messages.create({
        body: messageBody,
        from: fromNumber,
        to: toPhoneNumber
      });
    });

    return {
      success: true,
      messageSid: message.sid
    };
  } catch (error: any) {
    console.error('Twilio SMS error:', error);
    
    const errorMessage = getErrorMessage(error);
    const isRetryable = isRetryableError(error);
    
    return {
      success: false,
      error: errorMessage,
      errorCode: error.code,
      isRetryable
    };
  }
}

export async function getMessageStatus(messageSid: string): Promise<{
  status: string;
  errorCode?: number;
  errorMessage?: string;
} | null> {
  try {
    const client = await getTwilioClient();
    const message = await client.messages(messageSid).fetch();
    
    return {
      status: message.status,
      errorCode: message.errorCode ?? undefined,
      errorMessage: message.errorMessage ?? undefined
    };
  } catch (error: any) {
    console.error('Failed to fetch message status:', error);
    return null;
  }
}

export async function isTwilioConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}
