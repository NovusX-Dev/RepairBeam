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
  deviceMemory?: string | null;
  deviceStorageCapacity?: string | null;
  serialNumber?: string | null;
  issueDescription?: string | null;
  estimatedCost?: string | null;
  estimatedHours?: number | null;
  serviceChecklist?: any;
  selectedServices?: Array<{ name: string; cost: string }> | null;
  identifiedDefects?: string[] | null;
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
    memory: 'Memory',
    storage: 'Storage',
    serialNumber: 'Serial Number',
    issueInfo: 'Reported Issue',
    issue: 'Issue Description',
    serviceChecklist: 'Device Condition Checklist',
    additionalNotes: 'Additional Notes',
    identifiedDefects: 'Identified Defects',
    selectedServices: 'Selected Services',
    serviceName: 'Service',
    serviceCost: 'Cost',
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
    memory: 'Memória',
    storage: 'Armazenamento',
    serialNumber: 'Número de Série',
    issueInfo: 'Problema Relatado',
    issue: 'Descrição do Problema',
    serviceChecklist: 'Checklist de Condição do Dispositivo',
    additionalNotes: 'Observações Adicionais',
    identifiedDefects: 'Defeitos Identificados',
    selectedServices: 'Serviços Selecionados',
    serviceName: 'Serviço',
    serviceCost: 'Custo',
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
          <View style={styles.col33}>
            <Text style={styles.label}>{t.name}:</Text>
            <Text style={styles.value}>{props.customerName}</Text>
          </View>
          <View style={styles.col33}>
            <Text style={styles.label}>{t.phone}:</Text>
            <Text style={styles.value}>{props.customerPhone || '-'}</Text>
          </View>
          <View style={styles.col33}>
            <Text style={styles.label}>{t.email}:</Text>
            <Text style={styles.value}>{props.customerEmail || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Device Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.deviceInfo}</Text>
        <View style={styles.row}>
          <View style={styles.col25}>
            <Text style={styles.label}>{t.deviceType}:</Text>
            <Text style={styles.value}>{props.deviceType || '-'}</Text>
          </View>
          <View style={styles.col25}>
            <Text style={styles.label}>{t.brand}:</Text>
            <Text style={styles.value}>{props.deviceBrand || '-'}</Text>
          </View>
          <View style={styles.col25}>
            <Text style={styles.label}>{t.model}:</Text>
            <Text style={styles.value}>{props.deviceModel || '-'}</Text>
          </View>
          <View style={styles.col25}>
            <Text style={styles.label}>{t.color}:</Text>
            <Text style={styles.value}>{props.deviceColor || '-'}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col25}>
            <Text style={styles.label}>{t.memory}:</Text>
            <Text style={styles.value}>{props.deviceMemory || '-'}</Text>
          </View>
          <View style={styles.col25}>
            <Text style={styles.label}>{t.storage}:</Text>
            <Text style={styles.value}>{props.deviceStorageCapacity || '-'}</Text>
          </View>
          <View style={styles.col50}>
            <Text style={styles.label}>{t.serialNumber}:</Text>
            <Text style={styles.value}>{props.serialNumber || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Reported Issue */}
      {props.issueDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.issueInfo}</Text>
          <Text style={styles.value}>{props.issueDescription}</Text>
        </View>
      )}

      {/* Identified Defects */}
      {props.identifiedDefects && props.identifiedDefects.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.identifiedDefects}</Text>
          {props.identifiedDefects.map((defect: string, index: number) => (
            <View key={index} style={styles.row}>
              <View style={{ width: '10%' }}>
                <Text style={styles.label}>•</Text>
              </View>
              <View style={{ width: '90%' }}>
                <Text style={styles.value}>{defect}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Selected Services */}
      {props.selectedServices && props.selectedServices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.selectedServices}</Text>
          {props.selectedServices.map((service, index) => (
            <View key={index} style={styles.row}>
              <View style={styles.col50}>
                <Text style={styles.label}>{service.name}</Text>
              </View>
              <View style={styles.col50}>
                <Text style={styles.value}>{currencySymbol} {service.cost}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Service Checklist */}
      {props.serviceChecklist && (props.serviceChecklist.additionalNotes || (props.serviceChecklist.selectedChecklists && props.serviceChecklist.selectedChecklists.length > 0)) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.serviceChecklist}</Text>
          {props.serviceChecklist.selectedChecklists && props.serviceChecklist.selectedChecklists.length > 0 && (
            <>
              {props.serviceChecklist.selectedChecklists.map((checklistName: string, index: number) => (
                <View key={index} style={styles.row}>
                  <View style={{ width: '10%' }}>
                    <Text style={styles.label}>•</Text>
                  </View>
                  <View style={{ width: '90%' }}>
                    <Text style={styles.value}>{checklistName}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          {props.serviceChecklist.additionalNotes && (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.label, { marginBottom: 4 }]}>{t.additionalNotes}:</Text>
              <Text style={styles.value}>{props.serviceChecklist.additionalNotes}</Text>
            </View>
          )}
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

      {/* Disclaimer & Warranty - Combined */}
      <View style={{ marginTop: 8, flexDirection: 'row' }}>
        <View style={{ ...styles.disclaimer, flex: 1, marginTop: 0, marginRight: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400e', marginBottom: 3 }}>
            {t.disclaimer}
          </Text>
          <Text style={styles.disclaimerText}>{t.disclaimerText}</Text>
        </View>
        <View style={{ ...styles.warrantySection, flex: 1, marginTop: 0 }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e40af', marginBottom: 3 }}>
            {t.warranty}
          </Text>
          <Text style={styles.warrantyText}>{t.warrantyText}</Text>
        </View>
      </View>

      {/* Signature Area */}
      <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ width: '60%' }}>
          <View style={{ borderBottom: '1 solid #000', marginBottom: 3, height: 24 }} />
          <Text style={{ fontSize: 8, color: '#666' }}>{t.signature}</Text>
        </View>
        <View style={{ width: '35%' }}>
          <View style={{ borderBottom: '1 solid #000', marginBottom: 3, height: 24 }} />
          <Text style={{ fontSize: 8, color: '#666' }}>{t.date}</Text>
        </View>
      </View>

      {/* Footer Note */}
      <View style={{ marginTop: 12, paddingTop: 8, borderTop: '1 solid #e5e7eb' }}>
        <Text style={{ fontSize: 7.5, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>{t.note}</Text>
      </View>
    </InvoiceTemplate>
  );
}
