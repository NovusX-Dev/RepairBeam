import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@shared/permissions";
import { format } from "date-fns";
import {
  Printer,
  CalendarIcon,
  DollarSign,
  Hash,
  TrendingUp,
  Star,
  Banknote,
  Smartphone,
  CreditCard,
  ArrowRightCircle,
  Receipt,
  FileText,
} from "lucide-react";
import type { Payment } from "@shared/schema";

interface DailySummary {
  date: string;
  payments: Payment[];
  summary: Record<string, { count: number; total: number }>;
  grandTotal: number;
  totalTransactions: number;
}

const METHOD_CONFIG: Record<string, { label: string; icon: typeof Banknote; color: string; bgColor: string; borderColor: string }> = {
  cash: { label: "Cash", icon: Banknote, color: "text-green-400", bgColor: "bg-green-500/10", borderColor: "border-green-500/30" },
  pix: { label: "PIX", icon: Smartphone, color: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30" },
  credit_card: { label: "Credit Card", icon: CreditCard, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  debit_card: { label: "Debit Card", icon: CreditCard, color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
  bank_transfer: { label: "Bank Transfer", icon: ArrowRightCircle, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30" },
  boleto: { label: "Boleto", icon: FileText, color: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30" },
};

function getMethodConfig(method: string) {
  return METHOD_CONFIG[method] || { label: method, icon: DollarSign, color: "text-gray-400", bgColor: "bg-gray-500/10", borderColor: "border-gray-500/30" };
}

export default function POS() {
  const { t, formatCurrency } = useLocalization();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data, isLoading, isError } = useQuery<DailySummary>({
    queryKey: [`/api/payments/daily-summary?date=${dateStr}`],
  });

  const grandTotal = data?.grandTotal ?? 0;
  const totalTransactions = data?.totalTransactions ?? 0;
  const avgTransaction = totalTransactions > 0 ? grandTotal / totalTransactions : 0;
  const payments = data?.payments ?? [];
  const summary = data?.summary ?? {};

  const mostUsedMethod = Object.entries(summary).reduce<{ method: string; count: number }>(
    (best, [method, info]) => (info.count > best.count ? { method, count: info.count } : best),
    { method: "-", count: 0 }
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <PermissionGate permission={PERMISSIONS.POS_ACCESS}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 20px; }
          .print-area .print-header { display: block !important; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .print-area table { border-collapse: collapse; width: 100%; }
          .print-area th, .print-area td { border: 1px solid #ccc; padding: 8px; text-align: left; color: black !important; }
          .print-area th { background: #f0f0f0 !important; font-weight: bold; }
          .print-area .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
          .print-area .method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .print-area .kpi-card, .print-area .method-card { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
          .print-area .kpi-card h3, .print-area .method-card h3 { font-size: 12px; color: #666 !important; margin: 0; }
          .print-area .kpi-card p, .print-area .method-card p { font-size: 18px; font-weight: bold; margin: 4px 0 0 0; }
          .no-print { display: none !important; }
          nav, aside, header, [data-sidebar], .sidebar { display: none !important; }
        }
      `}</style>

      <div className="print-area space-y-6 p-4 md:p-6">
        <div className="print-header hidden">
          <h1>{t("daily_close_out_report", "Daily Close-Out Report")}</h1>
          <p>{format(selectedDate, "PPPP")}</p>
          <p>{t("printed_at", "Printed at")}: {format(new Date(), "PPpp")}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t("daily_close_out", "Daily Cash Close-Out")}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {t("daily_close_out_desc", "Daily sales report and payment summary")}
            </p>
          </div>

          <div className="flex items-center gap-3 no-print">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[220px] justify-start text-left font-normal border-cyan-500/20 bg-slate-800/50 hover:bg-slate-700/50">
                  <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              <Printer className="mr-2 h-4 w-4" />
              {t("print_report", "Print Report")}
            </Button>
          </div>
        </div>

        {isError ? (
          <Card className="bg-[#0a1628]/80 backdrop-blur-sm border-red-500/30">
            <CardContent className="p-8 text-center">
              <DollarSign className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">{t("error_loading_data", "Error Loading Data")}</h3>
              <p className="text-sm text-slate-400">{t("daily_summary_error", "Could not load the daily summary. Please try again.")}</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-6 w-28 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
              <CardContent className="p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full mb-2" />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : totalTransactions === 0 ? (
          <Card className="bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Receipt className="h-16 w-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">
                {t("no_transactions", "No Transactions")}
              </h3>
              <p className="text-sm text-slate-500 text-center max-w-md">
                {t("no_transactions_desc", "No transactions were recorded for this date. Select a different date to view the report.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="kpi-card bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-400">
                      {t("total_sales", "Total Sales")}
                    </h3>
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <DollarSign className="h-5 w-5 text-green-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {formatCurrency(grandTotal)}
                  </p>
                </CardContent>
              </Card>

              <Card className="kpi-card bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-400">
                      {t("total_transactions", "Total Transactions")}
                    </h3>
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Hash className="h-5 w-5 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {totalTransactions}
                  </p>
                </CardContent>
              </Card>

              <Card className="kpi-card bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-400">
                      {t("average_transaction", "Average Transaction")}
                    </h3>
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <TrendingUp className="h-5 w-5 text-purple-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {formatCurrency(avgTransaction)}
                  </p>
                </CardContent>
              </Card>

              <Card className="kpi-card bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-400">
                      {t("most_used_method", "Most Used Method")}
                    </h3>
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Star className="h-5 w-5 text-cyan-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {mostUsedMethod.method !== "-" ? getMethodConfig(mostUsedMethod.method).label : "-"}
                  </p>
                  {mostUsedMethod.count > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {mostUsedMethod.count} {t("transactions_lower", "transactions")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-3">
                {t("payment_method_breakdown", "Payment Method Breakdown")}
              </h2>
              <div className="method-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(METHOD_CONFIG).map(([key, config]) => {
                  const methodData = summary[key];
                  const Icon = config.icon;
                  return (
                    <Card key={key} className={`method-card bg-[#0a1628]/80 backdrop-blur-sm border ${config.borderColor}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${config.bgColor}`}>
                            <Icon className={`h-5 w-5 ${config.color}`} />
                          </div>
                          <h3 className="text-sm font-medium text-slate-300">{config.label}</h3>
                        </div>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(methodData?.total ?? 0)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {methodData?.count ?? 0} {t("transactions_lower", "transactions")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-3">
                {t("transactions_list", "Transactions")}
              </h2>
              <Card className="bg-[#0a1628]/80 backdrop-blur-sm border-cyan-500/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-cyan-500/10 hover:bg-transparent">
                        <TableHead className="text-slate-400">{t("payment_number", "Payment #")}</TableHead>
                        <TableHead className="text-slate-400">{t("method", "Method")}</TableHead>
                        <TableHead className="text-slate-400 text-right">{t("amount", "Amount")}</TableHead>
                        <TableHead className="text-slate-400">{t("reference", "Reference")}</TableHead>
                        <TableHead className="text-slate-400">{t("time", "Time")}</TableHead>
                        <TableHead className="text-slate-400">{t("invoice_number", "Invoice #")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment: Payment) => {
                        const config = getMethodConfig(payment.paymentMethodType);
                        const Icon = config.icon;
                        const paymentTime = payment.processedAt || payment.createdAt;
                        return (
                          <TableRow key={payment.id} className="border-cyan-500/10 hover:bg-slate-800/30">
                            <TableCell className="font-medium text-slate-200">
                              {payment.paymentNumber}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${config.color}`} />
                                <span className="text-slate-300 text-sm">{config.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-white">
                              {formatCurrency(Number(payment.amount))}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {payment.referenceNumber || "-"}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {paymentTime ? format(new Date(paymentTime), "HH:mm") : "-"}
                            </TableCell>
                            <TableCell>
                              {payment.posInvoiceId ? (
                                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {payment.posInvoiceId.slice(0, 8)}
                                </Badge>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
