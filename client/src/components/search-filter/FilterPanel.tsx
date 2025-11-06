import { ReactNode } from "react";
import { X, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocalization } from "@/contexts/LocalizationContext";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  children: ReactNode;
  activeCount: number;
  onClearAll: () => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function FilterPanel({
  children,
  activeCount,
  onClearAll,
  isOpen,
  onToggle,
  className
}: FilterPanelProps) {
  const { t } = useLocalization();

  return (
    <div className={cn("relative", className)}>
      {/* Toggle Button - visible when panel is closed */}
      {!isOpen && (
        <Button
          onClick={onToggle}
          variant="outline"
          size="sm"
          className="border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 transition-all"
          data-testid="button-toggle-filters"
        >
          <Filter className="w-4 h-4 mr-2" />
          {t("filters", "Filters")}
          {activeCount > 0 && (
            <Badge 
              variant="secondary" 
              className="ml-2 bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/40"
              data-testid="badge-active-filters-count"
            >
              {activeCount}
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      )}

      {/* Filter Panel - collapsible sidebar */}
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleContent className="transition-all duration-300 ease-in-out">
          <div
            className="w-80 h-full bg-gradient-to-b from-[#0A192F] to-[#0D1F3F] border border-[#00FFFF]/20 rounded-lg shadow-lg"
            data-testid="panel-filters"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#00FFFF]/20">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#00FFFF]" />
                <h3 className="text-lg font-semibold text-white">
                  {t("filters", "Filters")}
                </h3>
                {activeCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/40"
                    data-testid="badge-active-filters-count"
                  >
                    {activeCount}
                  </Badge>
                )}
              </div>
              
              <Button
                onClick={onToggle}
                variant="ghost"
                size="sm"
                className="hover:bg-[#00FFFF]/10 text-gray-400 hover:text-white"
                data-testid="button-toggle-filters"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            {/* Active Filters Summary */}
            {activeCount > 0 && (
              <>
                <div className="p-4 bg-[#00FFFF]/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">
                      {t("active_filters", "Active Filters")} ({activeCount})
                    </span>
                    <Button
                      onClick={onClearAll}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs hover:bg-[#00FFFF]/10 text-[#00FFFF] hover:text-[#00FFFF]"
                      data-testid="button-clear-all-filters"
                    >
                      <X className="w-3 h-3 mr-1" />
                      {t("clear_all", "Clear All")}
                    </Button>
                  </div>
                </div>
                <Separator className="bg-[#00FFFF]/10" />
              </>
            )}

            {/* Filter Controls */}
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="p-4 space-y-6">
                {children}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-[#00FFFF]/20 bg-gradient-to-t from-[#0A192F] to-transparent">
              <Button
                onClick={onClearAll}
                variant="outline"
                className="w-full border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 text-white"
                disabled={activeCount === 0}
                data-testid="button-clear-all-filters"
              >
                <X className="w-4 h-4 mr-2" />
                {t("reset_filters", "Reset All Filters")}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
