import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #1e3a8a',
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  shopAddress: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
    textAlign: 'right',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 11,
    textAlign: 'right',
    color: '#444',
  },
  invoiceDate: {
    fontSize: 9,
    textAlign: 'right',
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 8,
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  col50: {
    width: '50%',
  },
  col33: {
    width: '33.333%',
  },
  col25: {
    width: '25%',
  },
  col75: {
    width: '75%',
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottom: '2 solid #1e3a8a',
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #e5e7eb',
  },
  tableCol: {
    fontSize: 9,
  },
  summarySection: {
    marginTop: 15,
    alignItems: 'flex-end',
  },
  summaryRow: {
    flexDirection: 'row',
    width: 250,
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#444',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  totalRow: {
    flexDirection: 'row',
    width: 250,
    justifyContent: 'space-between',
    borderTop: '2 solid #1e3a8a',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: '1 solid #e5e7eb',
  },
  footerText: {
    fontSize: 8,
    color: '#666',
    lineHeight: 1.5,
    textAlign: 'center',
  },
  disclaimer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fef3c7',
    border: '1 solid #fbbf24',
  },
  disclaimerText: {
    fontSize: 8,
    color: '#92400e',
    lineHeight: 1.5,
  },
  warrantySection: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#dbeafe',
    border: '1 solid #3b82f6',
  },
  warrantyText: {
    fontSize: 8,
    color: '#1e40af',
    lineHeight: 1.5,
  },
});

export interface InvoiceTemplateProps {
  shopName: string;
  shopLogo?: string | null;
  shopAddress?: string | null;
  invoiceTitle: string;
  invoiceNumber: string;
  invoiceDate: string;
  children: React.ReactNode;
}

export default function InvoiceTemplate({
  shopName,
  shopLogo,
  shopAddress,
  invoiceTitle,
  invoiceNumber,
  invoiceDate,
  children,
}: InvoiceTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.shopInfo}>
              {shopLogo && <Image src={shopLogo} style={styles.logo} />}
              <Text style={styles.shopName}>{shopName}</Text>
              {shopAddress && <Text style={styles.shopAddress}>{shopAddress}</Text>}
            </View>
            <View>
              <Text style={styles.invoiceTitle}>{invoiceTitle}</Text>
              <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
              <Text style={styles.invoiceDate}>{invoiceDate}</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        {children}
      </Page>
    </Document>
  );
}

export { styles };
