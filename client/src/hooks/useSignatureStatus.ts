import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type SignatureStatus = 'pending' | 'sent' | 'signed' | 'expired' | 'failed';

interface SignatureStatusData {
  id: string;
  status: SignatureStatus;
  type: 'dropoff' | 'pickup';
  expiresAt: string;
  signedAt?: string;
  hasSignature: boolean;
}

interface UseSignatureStatusOptions {
  signatureRequestId: string | null;
  pollingInterval?: number;
  enabled?: boolean;
  onSigned?: (data: SignatureStatusData) => void;
  onExpired?: (data: SignatureStatusData) => void;
  onFailed?: (data: SignatureStatusData) => void;
}

export function useSignatureStatus({
  signatureRequestId,
  pollingInterval = 5000,
  enabled = true,
  onSigned,
  onExpired,
  onFailed,
}: UseSignatureStatusOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();
  const callbacksRef = useRef({ onSigned, onExpired, onFailed });
  
  useEffect(() => {
    callbacksRef.current = { onSigned, onExpired, onFailed };
  }, [onSigned, onExpired, onFailed]);

  const query = useQuery<SignatureStatusData>({
    queryKey: ['/api/signature-requests', signatureRequestId, 'status'],
    queryFn: async () => {
      if (!signatureRequestId) throw new Error('No signature request ID');
      const response = await fetch(`/api/signature-requests/${signatureRequestId}/status`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch signature status');
      }
      return response.json();
    },
    enabled: !!signatureRequestId && enabled && isPolling,
    refetchInterval: isPolling ? pollingInterval : false,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.data) {
      const { status } = query.data;
      
      if (status === 'signed') {
        setIsPolling(false);
        callbacksRef.current.onSigned?.(query.data);
      } else if (status === 'expired') {
        setIsPolling(false);
        callbacksRef.current.onExpired?.(query.data);
      } else if (status === 'failed') {
        setIsPolling(false);
        callbacksRef.current.onFailed?.(query.data);
      }
    }
  }, [query.data]);

  const startPolling = useCallback(() => {
    if (signatureRequestId) {
      setIsPolling(true);
    }
  }, [signatureRequestId]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const refresh = useCallback(() => {
    if (signatureRequestId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/signature-requests', signatureRequestId, 'status'] 
      });
    }
  }, [signatureRequestId, queryClient]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isPolling,
    error: query.error,
    startPolling,
    stopPolling,
    refresh,
  };
}

export interface CreateSignatureRequestParams {
  clientId: string;
  ticketId?: string;
  type: 'dropoff' | 'pickup';
  language?: 'en' | 'pt-BR';
}

export interface CreateSignatureRequestResult {
  id: string;
  status: SignatureStatus;
  token: string;
  expiresAt: string;
  message?: string;
  error?: string;
}

export async function createSignatureRequest(
  params: CreateSignatureRequestParams
): Promise<CreateSignatureRequestResult> {
  const response = await fetch('/api/signature-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to create signature request');
  }
  
  return response.json();
}

export async function resendSignatureRequest(
  id: string,
  language: 'en' | 'pt-BR' = 'en'
): Promise<CreateSignatureRequestResult> {
  const response = await fetch(`/api/signature-requests/${id}/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ language }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to resend signature request');
  }
  
  return response.json();
}

export async function checkTwilioConfig(): Promise<boolean> {
  try {
    const response = await fetch('/api/signature-requests/config', {
      credentials: 'include',
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.configured === true;
  } catch {
    return false;
  }
}
