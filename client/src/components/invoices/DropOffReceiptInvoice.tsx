import { View, Text } from '@react-pdf/renderer';
import InvoiceTemplate, { styles } from './InvoiceTemplate';

export interface DropOffReceiptData {
  shopName: string;
  shopLogo?: string | null;
  shopAddress?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  deviceType?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceColor?: string | null;
  serialNumber?: string | null;
  issueDescription?: string | null;
  estimatedCost?: string | null;
  estimatedHours?: number | null;
  serviceChecklist?: any;
  language: 'en' | 'pt-BR';
}

// Localized text
const translations = {
  en: {
    title: 'DROP-OFF RECEIPT',
    customerInfo: 'Customer Information',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    deviceInfo: 'Device Information',
    deviceType: 'Type',
    brand: 'Brand',
    model: 'Model',
    color: 'Color',
    serialNumber: 'Serial Number',
    issueInfo: 'Reported Issue',
    issue: 'Issue Description',
    serviceChecklist: 'Device Condition Checklist',
    estimate: 'Cost Estimate',
    estimatedCost: 'Estimated Cost',
    estimatedTime: 'Estimated Time',
    hours: 'hours',
    disclaimer: 'IMPORTANT DISCLAIMER',
    disclaimerText: 'Customer is responsible for backing up all data. The repair shop is NOT liable for any data loss during repair. We strongly recommend backing up your device before leaving it for service. By signing below, you acknowledge and accept these terms.',
    warranty: 'WARRANTY TERMS',
    warrantyText: 'All repairs come with a standard warranty covering parts and labor. Warranty does not cover physical damage, liquid damage, or issues arising from unauthorized modifications after repair. Warranty is void if device is repaired by third parties.',
    signature: 'Customer Signature',
    date: 'Date',
    note: 'NOTE: This is a drop-off receipt, not a final invoice. Final charges will be provided upon completion.',
  },
  'pt-BR': {
    title: 'COMPROVANTE DE ENTREGA',
    customerInfo: 'Informações do Cliente',
    name: 'Nome',
    phone: 'Telefone',
    email: 'E-mail',
    deviceInfo: 'Informações do Dispositivo',
    deviceType: 'Tipo',
    brand: 'Marca',
    model: 'Modelo',
    color: 'Cor',
    serialNumber: 'Número de Série',
    issueInfo: 'Problema Relatado',
    issue: 'Descrição do Problema',
    serviceChecklist: 'Checklist de Condição do Dispositivo',
    estimate: 'Estimativa de Custo',
    estimatedCost: 'Custo Estimado',
    estimatedTime: 'Tempo Estimado',
    hours: 'horas',
    disclaimer: 'AVISO IMPORTANTE',
    disclaimerText: 'O cliente é responsável por fazer backup de todos os dados. A loja de reparos NÃO é responsável por qualquer perda de dados durante o reparo. Recomendamos fortemente fazer backup do seu dispositivo antes de deixá-lo para serviço. Ao assinar abaixo, você reconhece e aceita estes termos.',
    warranty: 'TERMOS DE GARANTIA',
    warrantyText: 'Todos os reparos vêm com garantia padrão cobrindo peças e mão de obra. A garantia não cobre danos físicos, danos causados por líquidos ou problemas decorrentes de modificações não autorizadas após o reparo. A garantia é anulada se o dispositivo for reparado por terceiros.',
    signature: 'Assinatura do Cliente',
    date: 'Data',
    note: 'NOTA: Este é um comprovante de entrega, não uma fatura final. Os custos finais serão fornecidos após a conclusão.',
  },
};

export default function DropOffReceiptInvoice(props: DropOffReceiptData) {
  const t = translations[props.language];
  const currencySymbol = props.language === 'pt-BR' ? 'R$' : '$';

  return (
    <InvoiceTemplate
      shopName={props.shopName}
      shopLogo={props.shopLogo}
      shopAddress={props.shopAddress}
      invoiceTitle={t.title}
      invoiceNumber={props.invoiceNumber}
      invoiceDate={props.invoiceDate}
    >
      {/* Customer Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.customerInfo}</Text>
        <View style={styles.row}>
          <View style={styles.col50}>
            <Text style={styles.label}>{t.name}:</Text>
            <Text style={styles.value}>{props.customerName}</Text>
          </View>
          {props.customerPhone && (
            <View style={styles.col50}>
              <Text style={styles.label}>{t.phone}:</Text>
              <Text style={styles.value}>{props.customerPhone}</Text>
            </View>
          )}
        </View>
        {props.customerEmail && (
          <View style={styles.row}>
            <View style={styles.col50}>
              <Text style={styles.label}>{t.email}:</Text>
              <Text style={styles.value}>{props.customerEmail}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Device Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.deviceInfo}</Text>
        <View style={styles.row}>
          {props.deviceType && (
            <View style={styles.col25}>
              <Text style={styles.label}>{t.deviceType}:</Text>
              <Text style={styles.value}>{props.deviceType}</Text>
            </View>
          )}
          {props.deviceBrand && (
            <View style={styles.col25}>
              <Text style={styles.label}>{t.brand}:</Text>
              <Text style={styles.value}>{props.deviceBrand}</Text>
            </View>
          )}
          {props.deviceModel && (
            <View style={styles.col25}>
              <Text style={styles.label}>{t.model}:</Text>
              <Text style={styles.value}>{props.deviceModel}</Text>
            </View>
          )}
          {props.deviceColor && (
            <View style={styles.col25}>
              <Text style={styles.label}>{t.color}:</Text>
              <Text style={styles.value}>{props.deviceColor}</Text>
            </View>
          )}
        </View>
        {props.serialNumber && (
          <View style={styles.row}>
            <View style={styles.col50}>
              <Text style={styles.label}>{t.serialNumber}:</Text>
              <Text style={styles.value}>{props.serialNumber}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Reported Issue */}
      {props.issueDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.issueInfo}</Text>
          <Text style={styles.value}>{props.issueDescription}</Text>
        </View>
      )}

      {/* Service Checklist */}
      {props.serviceChecklist && Object.keys(props.serviceChecklist).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.serviceChecklist}</Text>
          {Object.entries(props.serviceChecklist).map(([component, condition]: [string, any]) => (
            <View key={component} style={styles.row}>
              <View style={styles.col50}>
                <Text style={styles.label}>{component}:</Text>
              </View>
              <View style={styles.col50}>
                <Text style={styles.value}>{condition?.status || condition}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Estimate */}
      {(props.estimatedCost || props.estimatedHours) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.estimate}</Text>
          <View style={styles.row}>
            {props.estimatedCost && (
              <View style={styles.col50}>
                <Text style={styles.label}>{t.estimatedCost}:</Text>
                <Text style={styles.value}>{currencySymbol} {props.estimatedCost}</Text>
              </View>
            )}
            {props.estimatedHours && (
              <View style={styles.col50}>
                <Text style={styles.label}>{t.estimatedTime}:</Text>
                <Text style={styles.value}>{props.estimatedHours} {t.hours}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>
          {t.disclaimer}
        </Text>
        <Text style={styles.disclaimerText}>{t.disclaimerText}</Text>
      </View>

      {/* Warranty */}
      <View style={styles.warrantySection}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>
          {t.warranty}
        </Text>
        <Text style={styles.warrantyText}>{t.warrantyText}</Text>
      </View>

      {/* Signature Area */}
      <View style={{ marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: '45%' }}>
          <View style={{ borderBottom: '1 solid #000', marginBottom: 4, height: 40 }} />
          <Text style={{ fontSize: 9, color: '#666' }}>{t.signature}</Text>
        </View>
        <View style={{ width: '30%' }}>
          <View style={{ borderBottom: '1 solid #000', marginBottom: 4, height: 40 }} />
          <Text style={{ fontSize: 9, color: '#666' }}>{t.date}</Text>
        </View>
      </View>

      {/* Footer Note */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t.note}</Text>
      </View>
    </InvoiceTemplate>
  );
}
