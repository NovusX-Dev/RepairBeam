import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Badge } from "@/components/ui/badge";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onClear?: () => void;
}

export function DateRangePicker({ value, onChange, onClear }: DateRangePickerProps) {
  const { t, currentLanguage } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const locale = currentLanguage.code === 'pt-BR' ? ptBR : undefined;

  const presets = [
    {
      label: t("today", "Today"),
      getValue: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return { from: today, to: today };
      }
    },
    {
      label: t("this_week", "This Week"),
      getValue: () => {
        const today = new Date();
        const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
        firstDay.setHours(0, 0, 0, 0);
        return { from: firstDay, to: new Date() };
      }
    },
    {
      label: t("last_30_days", "Last 30 Days"),
      getValue: () => {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        return { from: thirtyDaysAgo, to: new Date() };
      }
    },
    {
      label: t("last_90_days", "Last 90 Days"),
      getValue: () => {
        const today = new Date();
        const ninetyDaysAgo = new Date(today.setDate(today.getDate() - 90));
        ninetyDaysAgo.setHours(0, 0, 0, 0);
        return { from: ninetyDaysAgo, to: new Date() };
      }
    }
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    onChange(preset.getValue());
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange({ from: undefined, to: undefined });
    onClear?.();
  };

  const formatDateRange = () => {
    if (!value.from && !value.to) return t("select_date_range", "Select date range");
    if (value.from && !value.to) return format(value.from, "PP", { locale });
    if (value.from && value.to) {
      return `${format(value.from, "PP", { locale })} - ${format(value.to, "PP", { locale })}`;
    }
    return t("select_date_range", "Select date range");
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[280px] justify-start text-left font-normal border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10"
            data-testid="button-date-range-picker"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{formatDateRange()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets sidebar */}
            <div className="border-r p-3 space-y-1">
              <div className="text-xs font-medium text-gray-500 mb-2">
                {t("quick_select", "Quick Select")}
              </div>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handlePresetClick(preset)}
                  data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Calendar */}
            <div className="p-3">
              <Calendar
                mode="range"
                selected={value}
                onSelect={(range) => range && onChange(range as DateRange)}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {(value.from || value.to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-9 px-2 hover:bg-[#00FFFF]/10"
          data-testid="button-clear-date-range"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
