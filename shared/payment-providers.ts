import type { PaymentMethodType, PaymentStatus } from './schema';

export interface PaymentProviderConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  sandbox?: boolean;
  [key: string]: any;
}

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  paymentMethodType: PaymentMethodType;
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  description?: string;
  metadata?: Record<string, any>;
  installments?: number;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: PaymentStatus;
  providerResponse?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  pixExpiresAt?: Date;
  redirectUrl?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status: string;
  providerResponse?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
}

export interface WebhookEvent {
  type: string;
  transactionId?: string;
  status?: PaymentStatus;
  rawPayload: any;
}

export interface PaymentProviderInterface {
  readonly providerName: string;
  readonly supportedMethods: PaymentMethodType[];
  
  initialize(config: PaymentProviderConfig): Promise<void>;
  
  createPayment(request: CreatePaymentRequest): Promise<PaymentResult>;
  
  getPaymentStatus(transactionId: string): Promise<PaymentResult>;
  
  refundPayment(request: RefundRequest): Promise<RefundResult>;
  
  cancelPayment(transactionId: string): Promise<PaymentResult>;
  
  parseWebhookEvent(payload: any, signature?: string): WebhookEvent | null;
  
  verifyWebhookSignature(payload: any, signature: string): boolean;
}

export abstract class BasePaymentProvider implements PaymentProviderInterface {
  abstract readonly providerName: string;
  abstract readonly supportedMethods: PaymentMethodType[];
  
  protected config: PaymentProviderConfig = {};
  protected initialized = false;
  
  async initialize(config: PaymentProviderConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }
  
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`${this.providerName} provider not initialized. Call initialize() first.`);
    }
  }
  
  abstract createPayment(request: CreatePaymentRequest): Promise<PaymentResult>;
  abstract getPaymentStatus(transactionId: string): Promise<PaymentResult>;
  abstract refundPayment(request: RefundRequest): Promise<RefundResult>;
  abstract cancelPayment(transactionId: string): Promise<PaymentResult>;
  abstract parseWebhookEvent(payload: any, signature?: string): WebhookEvent | null;
  abstract verifyWebhookSignature(payload: any, signature: string): boolean;
}

export class ManualPaymentProvider extends BasePaymentProvider {
  readonly providerName = 'manual';
  readonly supportedMethods: PaymentMethodType[] = ['cash', 'bank_transfer', 'other'];
  
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    this.ensureInitialized();
    
    const transactionId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return {
      success: true,
      transactionId,
      status: 'completed',
      providerResponse: {
        method: request.paymentMethodType,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        processedAt: new Date().toISOString(),
      },
    };
  }
  
  async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
    this.ensureInitialized();
    
    return {
      success: true,
      transactionId,
      status: 'completed',
    };
  }
  
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    this.ensureInitialized();
    
    const refundId = `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return {
      success: true,
      refundId,
      status: 'completed',
      providerResponse: {
        originalTransactionId: request.transactionId,
        amount: request.amount,
        reason: request.reason,
        processedAt: new Date().toISOString(),
      },
    };
  }
  
  async cancelPayment(transactionId: string): Promise<PaymentResult> {
    this.ensureInitialized();
    
    return {
      success: true,
      transactionId,
      status: 'cancelled',
    };
  }
  
  parseWebhookEvent(_payload: any, _signature?: string): WebhookEvent | null {
    return null;
  }
  
  verifyWebhookSignature(_payload: any, _signature: string): boolean {
    return false;
  }
}

export type PaymentProviderType = 'stripe' | 'pagar_me' | 'manual';

export class PaymentProviderFactory {
  private static providers: Map<PaymentProviderType, PaymentProviderInterface> = new Map();
  
  static registerProvider(type: PaymentProviderType, provider: PaymentProviderInterface): void {
    this.providers.set(type, provider);
  }
  
  static getProvider(type: PaymentProviderType): PaymentProviderInterface | undefined {
    return this.providers.get(type);
  }
  
  static getAvailableProviders(): PaymentProviderType[] {
    return Array.from(this.providers.keys());
  }
  
  static getSupportedMethods(type: PaymentProviderType): PaymentMethodType[] {
    const provider = this.providers.get(type);
    return provider?.supportedMethods || [];
  }
}

PaymentProviderFactory.registerProvider('manual', new ManualPaymentProvider());
