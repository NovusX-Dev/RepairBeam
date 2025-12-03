import { useState, useEffect } from 'react';
import { useParams, useSearch } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import SignatureCanvas from '@/components/signature/SignatureCanvas';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, AlertTriangle, Smartphone, FileText, Loader2, Eye } from 'lucide-react';

interface SignatureData {
  id: string;
  type: 'dropoff' | 'pickup';
  status: string;
  expiresAt: string;
  client: {
    firstName: string;
    lastName: string;
  };
  store: {
    name: string;
    logo?: string;
  };
  ticket?: {
    id: string;
    title: string;
    deviceType: string;
    deviceBrand: string;
    deviceModel: string;
    estimatedCost: string;
    status: string;
  };
}

const DEMO_DATA: SignatureData = {
  id: 'demo-signature-request',
  type: 'dropoff',
  status: 'pending',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  client: {
    firstName: 'Maria',
    lastName: 'Silva',
  },
  store: {
    name: 'Repair Beam Demo Store',
  },
  ticket: {
    id: 'demo-ticket',
    title: 'Screen replacement and battery check',
    deviceType: 'smartphone',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 14 Pro',
    estimatedCost: '299.00',
    status: 'pending',
  },
};

export default function SignaturePage() {
  const { token } = useParams<{ token: string }>();
  const searchString = useSearch();
  const isDemo = token === 'demo';
  const [signature, setSignature] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [demoType, setDemoType] = useState<'dropoff' | 'pickup'>('dropoff');

  const getInitialLanguage = (): 'en' | 'pt-BR' => {
    const params = new URLSearchParams(searchString);
    const urlLang = params.get('lang');
    if (urlLang === 'pt-BR') return 'pt-BR';
    if (urlLang === 'en') return 'en';
    const browserLang = navigator.language;
    return browserLang.startsWith('pt') ? 'pt-BR' : 'en';
  };

  const [language, setLanguage] = useState<'en' | 'pt-BR'>(getInitialLanguage);

  const { data: apiSignatureData, isLoading, error } = useQuery<SignatureData>({
    queryKey: ['/api/public/signature', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/signature/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load signature request');
      }
      return response.json();
    },
    retry: false,
    enabled: !isDemo,
  });

  const signatureData = isDemo 
    ? { ...DEMO_DATA, type: demoType } 
    : apiSignatureData;

  const getDeviceMeta = () => {
    return {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages ? [...navigator.languages] : [navigator.language],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
    };
  };

  const submitMutation = useMutation({
    mutationFn: async (data: { signaturePng: string; agreedToTerms: boolean; deviceMeta: Record<string, unknown> }) => {
      const response = await fetch(`/api/public/signature/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit signature');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    if (isDemo) {
      setSubmitted(true);
      return;
    }
    if (signature && agreedToTerms) {
      const deviceMeta = getDeviceMeta();
      submitMutation.mutate({ signaturePng: signature, agreedToTerms, deviceMeta });
    }
  };

  const translations = {
    en: {
      loading: 'Loading...',
      expired: 'Link Expired',
      expiredDesc: 'This signature link has expired. Please request a new link from the store.',
      alreadySigned: 'Already Signed',
      alreadySignedDesc: 'This document has already been signed.',
      notFound: 'Not Found',
      notFoundDesc: 'This signature link is invalid or has been removed.',
      dropoffTitle: 'Repair Authorization',
      dropoffDesc: 'Please review the repair details and sign below to authorize the service.',
      pickupTitle: 'Device Pickup Confirmation',
      pickupDesc: 'Please sign below to confirm you have received your device.',
      deviceInfo: 'Device Information',
      device: 'Device',
      estimatedCost: 'Estimated Cost',
      terms: 'Terms & Conditions',
      termsDropoff: 'I authorize the repair service described above and agree to pay the estimated cost upon completion. I understand that actual costs may vary based on findings during repair.',
      termsPickup: 'I confirm that I have received my device and that it has been returned to me in satisfactory condition.',
      agreeTerms: 'I have read and agree to the terms above',
      signatureLabel: 'Your Signature',
      submit: 'Submit Signature',
      submitting: 'Submitting...',
      successTitle: 'Thank You!',
      successDropoff: 'Your repair has been authorized. The technician will begin working on your device.',
      successPickup: 'Device pickup confirmed. Thank you for choosing',
      pleaseSign: 'Please draw your signature',
      pleaseAgree: 'Please agree to the terms',
      demoMode: 'Preview Mode',
      demoModeDesc: 'This is a preview of the signature page. No data will be saved.',
      switchToPickup: 'Switch to Pickup View',
      switchToDropoff: 'Switch to Drop-off View',
      demoSuccess: 'This is a preview of the success screen. In production, the signature would be saved.',
    },
    'pt-BR': {
      loading: 'Carregando...',
      expired: 'Link Expirado',
      expiredDesc: 'Este link de assinatura expirou. Por favor, solicite um novo link na loja.',
      alreadySigned: 'Já Assinado',
      alreadySignedDesc: 'Este documento já foi assinado.',
      notFound: 'Não Encontrado',
      notFoundDesc: 'Este link de assinatura é inválido ou foi removido.',
      dropoffTitle: 'Autorização de Reparo',
      dropoffDesc: 'Por favor, revise os detalhes do reparo e assine abaixo para autorizar o serviço.',
      pickupTitle: 'Confirmação de Retirada',
      pickupDesc: 'Por favor, assine abaixo para confirmar que você recebeu seu dispositivo.',
      deviceInfo: 'Informações do Dispositivo',
      device: 'Dispositivo',
      estimatedCost: 'Custo Estimado',
      terms: 'Termos e Condições',
      termsDropoff: 'Eu autorizo o serviço de reparo descrito acima e concordo em pagar o custo estimado após a conclusão. Entendo que os custos reais podem variar com base nas descobertas durante o reparo.',
      termsPickup: 'Eu confirmo que recebi meu dispositivo e que ele foi devolvido a mim em condições satisfatórias.',
      agreeTerms: 'Li e concordo com os termos acima',
      signatureLabel: 'Sua Assinatura',
      submit: 'Enviar Assinatura',
      submitting: 'Enviando...',
      successTitle: 'Obrigado!',
      successDropoff: 'Seu reparo foi autorizado. O técnico começará a trabalhar no seu dispositivo.',
      successPickup: 'Retirada do dispositivo confirmada. Obrigado por escolher',
      pleaseSign: 'Por favor, desenhe sua assinatura',
      pleaseAgree: 'Por favor, concorde com os termos',
      demoMode: 'Modo de Visualização',
      demoModeDesc: 'Esta é uma visualização da página de assinatura. Nenhum dado será salvo.',
      switchToPickup: 'Mudar para Retirada',
      switchToDropoff: 'Mudar para Entrega',
      demoSuccess: 'Esta é uma visualização da tela de sucesso. Em produção, a assinatura seria salva.',
    },
  };

  const t = translations[language];

  if (isLoading && !isDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1128] to-[#1a2744] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#0f1a2e] border-[#1e3a5f]">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-300">{t.loading}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !isDemo) {
    const errorMessage = (error as Error).message || '';
    let icon = <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />;
    let title = t.notFound;
    let desc = t.notFoundDesc;

    if (errorMessage.includes('expired')) {
      icon = <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" />;
      title = t.expired;
      desc = t.expiredDesc;
    } else if (errorMessage.includes('already')) {
      icon = <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />;
      title = t.alreadySigned;
      desc = t.alreadySignedDesc;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1128] to-[#1a2744] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#0f1a2e] border-[#1e3a5f]">
          <CardContent className="p-8 text-center">
            {icon}
            <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
            <p className="text-gray-400">{desc}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    const successMessage = signatureData?.type === 'dropoff' 
      ? t.successDropoff 
      : `${t.successPickup} ${signatureData?.store.name}!`;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1128] to-[#1a2744] flex items-center justify-center p-4">
        <div className="max-w-md mx-auto space-y-4">
          {isDemo && (
            <Card className="bg-amber-500/20 border-amber-500/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Eye className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-200 font-medium text-sm">{t.demoMode}</p>
                  <p className="text-amber-300/70 text-xs">{t.demoSuccess}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="w-full bg-[#0f1a2e] border-[#1e3a5f]">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">{t.successTitle}</h2>
              <p className="text-gray-300">{successMessage}</p>
              {isDemo && (
                <Button 
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="mt-4 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                  data-testid="button-back-to-form"
                >
                  {language === 'pt-BR' ? 'Voltar ao Formulário' : 'Back to Form'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!signatureData) return null;

  const isDropoff = signatureData.type === 'dropoff';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1128] to-[#1a2744] py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        {isDemo && (
          <Card className="bg-amber-500/20 border-amber-500/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Eye className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-200 font-medium text-sm">{t.demoMode}</p>
                  <p className="text-amber-300/70 text-xs">{t.demoModeDesc}</p>
                </div>
              </div>
              <Button
                onClick={() => setDemoType(demoType === 'dropoff' ? 'pickup' : 'dropoff')}
                variant="outline"
                size="sm"
                className="w-full border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
                data-testid="button-toggle-demo-type"
              >
                {demoType === 'dropoff' ? t.switchToPickup : t.switchToDropoff}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center mb-6">
          {signatureData.store.logo ? (
            <img 
              src={signatureData.store.logo} 
              alt={signatureData.store.name} 
              className="h-16 mx-auto mb-4 object-contain"
            />
          ) : (
            <h1 className="text-2xl font-bold text-white mb-2">{signatureData.store.name}</h1>
          )}
        </div>

        <Card className="bg-[#0f1a2e] border-[#1e3a5f]">
          <CardHeader className="border-b border-[#1e3a5f] bg-gradient-to-r from-[#0f1a2e] to-[#1a2744]">
            <div className="flex items-center gap-3">
              {isDropoff ? (
                <FileText className="w-6 h-6 text-cyan-400" />
              ) : (
                <Smartphone className="w-6 h-6 text-cyan-400" />
              )}
              <div>
                <CardTitle className="text-white text-lg">
                  {isDropoff ? t.dropoffTitle : t.pickupTitle}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {isDropoff ? t.dropoffDesc : t.pickupDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="bg-[#1a2744] rounded-lg p-4 border border-[#2a3f5f]">
              <p className="text-gray-400 text-sm mb-1">
                {language === 'pt-BR' ? 'Cliente' : 'Client'}
              </p>
              <p className="text-white font-medium">
                {signatureData.client.firstName} {signatureData.client.lastName}
              </p>
            </div>

            {signatureData.ticket && (
              <div className="bg-[#1a2744] rounded-lg p-4 border border-[#2a3f5f] space-y-3">
                <h3 className="text-cyan-400 font-medium">{t.deviceInfo}</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.device}</span>
                    <span className="text-white">
                      {signatureData.ticket.deviceBrand} {signatureData.ticket.deviceModel}
                    </span>
                  </div>
                  {signatureData.ticket.estimatedCost && isDropoff && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.estimatedCost}</span>
                      <span className="text-cyan-400 font-medium">
                        ${signatureData.ticket.estimatedCost}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-gray-300 text-sm pt-2 border-t border-[#2a3f5f]">
                  {signatureData.ticket.title}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-cyan-400 font-medium">{t.terms}</h3>
              <div className="bg-[#1a2744] rounded-lg p-4 border border-[#2a3f5f]">
                <p className="text-gray-300 text-sm">
                  {isDropoff ? t.termsDropoff : t.termsPickup}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="agree-terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  className="mt-1 border-cyan-400 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-black"
                  data-testid="checkbox-agree-terms"
                />
                <label htmlFor="agree-terms" className="text-gray-300 text-sm cursor-pointer">
                  {t.agreeTerms}
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-cyan-400 font-medium">{t.signatureLabel}</h3>
              <SignatureCanvas onSignatureChange={setSignature} />
            </div>

            {(!signature || !agreedToTerms) && (
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{!signature ? t.pleaseSign : t.pleaseAgree}</span>
              </div>
            )}

            <Button 
              onClick={handleSubmit}
              disabled={!signature || !agreedToTerms || submitMutation.isPending}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-medium py-6"
              data-testid="button-submit-signature"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.submitting}
                </>
              ) : (
                t.submit
              )}
            </Button>

            {submitMutation.isError && (
              <p className="text-red-400 text-sm text-center">
                {(submitMutation.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <button 
            onClick={() => setLanguage(language === 'en' ? 'pt-BR' : 'en')}
            className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
            data-testid="button-toggle-language"
          >
            {language === 'en' ? '🇧🇷 Português' : '🇺🇸 English'}
          </button>
        </div>
      </div>
    </div>
  );
}
