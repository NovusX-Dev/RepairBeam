import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SearchableSelectProps {
  value?: string;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  items: string[];
  isLoading?: boolean;
  onValueChange?: (value: string) => void;
  onCustomValue?: (value: string) => void; // For when user types a custom value
  allowCustomInput?: boolean;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export function SearchableSelect({
  value,
  placeholder = "Select an option...",
  emptyText = "No items found.",
  searchPlaceholder = "Search...",
  items = [],
  isLoading = false,
  onValueChange,
  onCustomValue,
  allowCustomInput = false,
  className,
  disabled = false,
  "data-testid": testId,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filteredItems, setFilteredItems] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on search value
  useEffect(() => {
    if (!searchValue) {
      // Sort items alphabetically before setting
      setFilteredItems([...items].sort());
    } else {
      const filtered = items.filter((item) =>
        item.toLowerCase().includes(searchValue.toLowerCase())
      );
      // Sort filtered items alphabetically
      setFilteredItems(filtered.sort());
    }
  }, [items, searchValue]);

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onValueChange?.("");
    } else {
      onValueChange?.(selectedValue);
    }
    setOpen(false);
    setSearchValue("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchValue("");
    }
  };

  // Ensure proper wheel event handling
  useEffect(() => {
    const listElement = listRef.current;
    if (listElement && open) {
      const handleWheel = (e: WheelEvent) => {
        e.stopPropagation();
        // Allow default scrolling behavior
      };
      
      listElement.addEventListener('wheel', handleWheel, { passive: true });
      return () => {
        listElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled || isLoading}
          data-testid={testId}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            value || placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 max-h-80 overflow-hidden" align="start">
        <Command>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-9"
          />
          <div className="max-h-60 overflow-y-auto">
            <CommandList ref={listRef}>
              <CommandEmpty>
              {allowCustomInput && searchValue ? (
                <div className="p-2">
                  <div className="text-sm text-muted-foreground mb-2">
                    {emptyText}
                  </div>
                  <button
                    className="w-full p-2 text-left hover:bg-accent rounded text-sm border border-dashed border-muted-foreground/50"
                    onClick={() => {
                      if (onCustomValue && searchValue.trim()) {
                        onCustomValue(searchValue.trim());
                        setOpen(false);
                        setSearchValue("");
                      }
                    }}
                  >
                    Use "{searchValue}" as custom brand
                  </button>
                </div>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  onSelect={() => handleSelect(item)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item}
                </CommandItem>
              ))}
              </CommandGroup>
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}