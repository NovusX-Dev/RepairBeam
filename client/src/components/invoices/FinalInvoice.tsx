import { View, Text, Image } from '@react-pdf/renderer';
import InvoiceTemplate, { styles } from './InvoiceTemplate';

export interface FinalInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface FinalInvoiceData {
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
  serialNumber?: string | null;
  items: FinalInvoiceItem[];
  laborDescription?: string | null;
  laborHours?: number | null;
  laborRate?: number | null;
  laborTotal?: number;
  extraCost?: number | null;
  extraCostDescription?: string | null;
  warrantyCost?: number | null;
  warrantyType?: string | null;
  warrantyValidUntil?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: string | null;
  warrantyText?: string | null;
  footerText?: string | null;
  language: 'en' | 'pt-BR';
  pickupSignaturePng?: string | null;
  pickupSignedAt?: string | null;
}

// Localized text
const translations = {
  en: {
    title: 'INVOICE',
    customerInfo: 'Customer Information',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    deviceInfo: 'Device Information',
    deviceType: 'Type',
    brand: 'Brand',
    model: 'Model',
    serialNumber: 'Serial Number',
    partsAndMaterials: 'Parts & Materials',
    labor: 'Labor',
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    total: 'Total',
    hours: 'hours',
    rate: 'Rate',
    extraCost: 'Additional Costs',
    warrantyCost: 'Warranty',
    warrantyInfo: 'Warranty Information',
    warrantyTypeLabel: 'Type',
    warrantyValidUntil: 'Valid Until',
    standardWarranty: 'Standard Warranty',
    extendedWarranty: 'Extended Warranty',
    subtotal: 'Subtotal',
    tax: 'Tax',
    totalDue: 'TOTAL DUE',
    paymentInfo: 'Payment Information',
    paymentMethod: 'Payment Method',
    warranty: 'WARRANTY TERMS',
    defaultWarranty: 'All repairs include a 90-day warranty on parts and 30-day warranty on labor. Warranty does not cover physical damage, liquid damage, or issues arising from unauthorized modifications. Warranty is void if device is repaired by third parties after this service.',
    disclaimer: 'IMPORTANT',
    disclaimerText: 'Customer is responsible for data backup. Not liable for data loss. Replaced parts become property of the shop unless customer requests otherwise.',
    thankYou: 'Thank you for your business!',
    signature: 'Customer Signature',
    digitalSignature: 'Digital Signature',
    signedDigitally: 'Signed digitally on',
    deviceReceived: 'Device Received',
    date: 'Date',
  },
  'pt-BR': {
    title: 'FATURA',
    customerInfo: 'Informações do Cliente',
    name: 'Nome',
    phone: 'Telefone',
    email: 'E-mail',
    deviceInfo: 'Informações do Dispositivo',
    deviceType: 'Tipo',
    brand: 'Marca',
    model: 'Modelo',
    serialNumber: 'Número de Série',
    partsAndMaterials: 'Peças e Materiais',
    labor: 'Mão de Obra',
    description: 'Descrição',
    quantity: 'Qtd',
    unitPrice: 'Preço Unit.',
    total: 'Total',
    hours: 'horas',
    rate: 'Taxa',
    extraCost: 'Custos Adicionais',
    warrantyCost: 'Garantia',
    warrantyInfo: 'Informações de Garantia',
    warrantyTypeLabel: 'Tipo',
    warrantyValidUntil: 'Válido Até',
    standardWarranty: 'Garantia Padrão',
    extendedWarranty: 'Garantia Estendida',
    subtotal: 'Subtotal',
    tax: 'Imposto',
    totalDue: 'TOTAL A PAGAR',
    paymentInfo: 'Informações de Pagamento',
    paymentMethod: 'Método de Pagamento',
    warranty: 'TERMOS DE GARANTIA',
    defaultWarranty: 'Todos os reparos incluem garantia de 90 dias em peças e 30 dias em mão de obra. A garantia não cobre danos físicos, danos causados por líquidos ou problemas decorrentes de modificações não autorizadas. A garantia é anulada se o dispositivo for reparado por terceiros após este serviço.',
    disclaimer: 'IMPORTANTE',
    disclaimerText: 'O cliente é responsável pelo backup de dados. Não nos responsabilizamos por perda de dados. Peças substituídas tornam-se propriedade da loja, salvo solicitação do cliente.',
    thankYou: 'Obrigado pelo seu negócio!',
    signature: 'Assinatura do Cliente',
    digitalSignature: 'Assinatura Digital',
    signedDigitally: 'Assinado digitalmente em',
    deviceReceived: 'Dispositivo Recebido',
    date: 'Data',
  },
};

export default function FinalInvoice(props: FinalInvoiceData) {
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
          <View style={styles.col33}>
            <Text style={styles.label}>{t.deviceType}:</Text>
            <Text style={styles.value}>{props.deviceType || '-'}</Text>
          </View>
          <View style={styles.col33}>
            <Text style={styles.label}>{t.brand}:</Text>
            <Text style={styles.value}>{props.deviceBrand || '-'}</Text>
          </View>
          <View style={styles.col33}>
            <Text style={styles.label}>{t.model}:</Text>
            <Text style={styles.value}>{props.deviceModel || '-'}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col50}>
            <Text style={styles.label}>{t.serialNumber}:</Text>
            <Text style={styles.value}>{props.serialNumber || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Parts & Materials Table */}
      {props.items && props.items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.partsAndMaterials}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCol, { width: '50%' }]}>{t.description}</Text>
              <Text style={[styles.tableCol, { width: '15%', textAlign: 'center' }]}>{t.quantity}</Text>
              <Text style={[styles.tableCol, { width: '20%', textAlign: 'right' }]}>{t.unitPrice}</Text>
              <Text style={[styles.tableCol, { width: '15%', textAlign: 'right' }]}>{t.total}</Text>
            </View>
            {props.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCol, { width: '50%' }]}>{item.description}</Text>
                <Text style={[styles.tableCol, { width: '15%', textAlign: 'center' }]}>{item.quantity}</Text>
                <Text style={[styles.tableCol, { width: '20%', textAlign: 'right' }]}>
                  {currencySymbol} {item.unitPrice.toFixed(2)}
                </Text>
                <Text style={[styles.tableCol, { width: '15%', textAlign: 'right' }]}>
                  {currencySymbol} {item.total.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Labor */}
      {props.laborTotal !== undefined && props.laborTotal > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.labor}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCol, { width: '50%' }]}>{t.description}</Text>
              <Text style={[styles.tableCol, { width: '15%', textAlign: 'center' }]}>{t.hours}</Text>
              <Text style={[styles.tableCol, { width: '20%', textAlign: 'right' }]}>{t.rate}</Text>
              <Text style={[styles.tableCol, { width: '15%', textAlign: 'right' }]}>{t.total}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCol, { width: '50%' }]}>
                {props.laborDescription || t.labor}
              </Text>
              <Text style={[styles.tableCol, { width: '15%', textAlign: 'center' }]}>
                {props.laborHours || 0}
              </Text>
              <Text style={[styles.tableCol, { width: '20%', textAlign: 'right' }]}>
                {currencySymbol} {(props.laborRate || 0).toFixed(2)}
              </Text>
              <Text style={[styles.tableCol, { width: '15%', textAlign: 'right' }]}>
                {currencySymbol} {props.laborTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Summary */}
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.subtotal}:</Text>
          <Text style={styles.summaryValue}>{currencySymbol} {props.subtotal.toFixed(2)}</Text>
        </View>
        {props.extraCost !== null && props.extraCost !== undefined && props.extraCost > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.extraCost}:</Text>
            <Text style={styles.summaryValue}>{currencySymbol} {props.extraCost.toFixed(2)}</Text>
          </View>
        )}
        {props.warrantyCost !== null && props.warrantyCost !== undefined && props.warrantyCost > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.warrantyCost}:</Text>
            <Text style={styles.summaryValue}>{currencySymbol} {props.warrantyCost.toFixed(2)}</Text>
          </View>
        )}
        {props.taxAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.tax} ({props.taxRate}%):</Text>
            <Text style={styles.summaryValue}>{currencySymbol} {props.taxAmount.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.totalDue}:</Text>
          <Text style={styles.totalValue}>{currencySymbol} {props.totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      {/* Warranty Information */}
      {(props.warrantyType || props.warrantyValidUntil) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.warrantyInfo}</Text>
          <View style={styles.row}>
            {props.warrantyType && (
              <View style={styles.col50}>
                <Text style={styles.label}>{t.warrantyTypeLabel}:</Text>
                <Text style={styles.value}>
                  {props.warrantyType === 'extended' ? t.extendedWarranty : t.standardWarranty}
                </Text>
              </View>
            )}
            {props.warrantyValidUntil && (
              <View style={styles.col50}>
                <Text style={styles.label}>{t.warrantyValidUntil}:</Text>
                <Text style={styles.value}>{props.warrantyValidUntil}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Payment Information */}
      {props.paymentMethod && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.paymentInfo}</Text>
          <View style={styles.row}>
            <View style={styles.col50}>
              <Text style={styles.label}>{t.paymentMethod}:</Text>
              <Text style={styles.value}>{props.paymentMethod}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Warranty & Disclaimer - Combined */}
      <View style={{ marginTop: 8, flexDirection: 'row' }}>
        <View style={{ backgroundColor: '#eff6ff', borderRadius: 4, padding: 6, flex: 1, marginRight: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e40af', marginBottom: 3 }}>
            {t.warranty}
          </Text>
          <Text style={{ fontSize: 7.5, color: '#333', lineHeight: 1.4 }}>
            {props.warrantyText || t.defaultWarranty}
          </Text>
        </View>
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 4, padding: 6, flex: 1 }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400e', marginBottom: 3 }}>
            {t.disclaimer}
          </Text>
          <Text style={{ fontSize: 7.5, color: '#333', lineHeight: 1.4 }}>{t.disclaimerText}</Text>
        </View>
      </View>

      {/* Signature Area */}
      <View style={{ marginTop: 16 }}>
        {props.pickupSignaturePng ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ width: '60%' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>
                {t.digitalSignature} - {t.deviceReceived}
              </Text>
              <View style={{ 
                border: '1 solid #e5e7eb', 
                borderRadius: 4, 
                padding: 8, 
                backgroundColor: '#f9fafb',
                height: 50,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Image 
                  src={props.pickupSignaturePng} 
                  style={{ maxHeight: 40, maxWidth: 180, objectFit: 'contain' }} 
                />
              </View>
            </View>
            <View style={{ width: '35%' }}>
              <Text style={{ fontSize: 8, color: '#666', marginBottom: 4 }}>{t.date}:</Text>
              <Text style={{ fontSize: 9, color: '#333' }}>
                {props.pickupSignedAt || props.invoiceDate}
              </Text>
              <Text style={{ fontSize: 7, color: '#10b981', marginTop: 4 }}>
                {t.signedDigitally}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ width: '60%' }}>
              <View style={{ borderBottom: '1 solid #000', marginBottom: 3, height: 24 }} />
              <Text style={{ fontSize: 8, color: '#666' }}>{t.signature}</Text>
            </View>
            <View style={{ width: '35%' }}>
              <View style={{ borderBottom: '1 solid #000', marginBottom: 3, height: 24 }} />
              <Text style={{ fontSize: 8, color: '#666' }}>{t.date}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={{ marginTop: 12, paddingTop: 8, borderTop: '1 solid #e5e7eb' }}>
        <Text style={{ fontSize: 7.5, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
          {props.footerText || t.thankYou}
        </Text>
      </View>
    </InvoiceTemplate>
  );
}
