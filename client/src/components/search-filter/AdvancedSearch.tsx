import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/contexts/LocalizationContext";

interface AdvancedSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onClear?: () => void;
}

export function AdvancedSearch({ 
  value, 
  onChange, 
  placeholder, 
  debounceMs = 300,
  onClear 
}: AdvancedSearchProps) {
  const { t } = useLocalization();
  const [searchValue, setSearchValue] = useState(value);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(searchValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchValue, debounceMs, onChange]);

  // Sync external changes
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  const handleClear = () => {
    setSearchValue("");
    onChange("");
    onClear?.();
  };

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={placeholder || t("search_placeholder", "Search...")}
        className="pl-10 pr-10 bg-white border-[#00FFFF]/30 focus:border-[#00FFFF] focus:ring-[#00FFFF]/20"
        data-testid="input-advanced-search"
      />
      {searchValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-[#00FFFF]/10"
          data-testid="button-clear-search"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
