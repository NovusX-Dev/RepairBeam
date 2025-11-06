import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";

// Type for custom serialization functions
export interface FilterFieldSerializer<T = any> {
  encode: (value: T) => string;
  decode: (value: string) => T | undefined;
}

// Default serializers for common types
const defaultSerializers: Record<string, FilterFieldSerializer> = {
  string: {
    encode: (value: string) => value,
    decode: (value: string) => value || undefined,
  },
  number: {
    encode: (value: number) => String(value),
    decode: (value: string) => {
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    },
  },
  boolean: {
    encode: (value: boolean) => String(value),
    decode: (value: string) => value === "true" ? true : value === "false" ? false : undefined,
  },
  date: {
    encode: (value: Date) => value.toISOString(),
    decode: (value: string) => {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    },
  },
  array: {
    encode: (value: any[]) => JSON.stringify(value),
    decode: (value: string) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    },
  },
  object: {
    encode: (value: Record<string, any>) => JSON.stringify(value),
    decode: (value: string) => {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null ? parsed : undefined;
      } catch {
        return undefined;
      }
    },
  },
};

interface UseFilterStateOptions<T extends Record<string, any>> {
  debounceMs?: number;
  syncWithUrl?: boolean;
  serializers?: Partial<Record<keyof T, FilterFieldSerializer>>;
}

export function useFilterState<T extends Record<string, any>>(
  initialFilters: T,
  options: UseFilterStateOptions<T> = {}
) {
  const { debounceMs = 300, syncWithUrl = true, serializers = {} } = options;
  const [location] = useLocation();
  
  // Helper to get serializer for a field
  const getSerializer = useCallback((key: keyof T): FilterFieldSerializer => {
    if (serializers[key]) {
      return serializers[key]!;
    }
    
    const initialValue = initialFilters[key];
    if (initialValue === undefined || initialValue === null) {
      return defaultSerializers.string;
    }
    
    if (Array.isArray(initialValue)) return defaultSerializers.array;
    if (initialValue instanceof Date) return defaultSerializers.date;
    
    const type = typeof initialValue;
    return defaultSerializers[type] || defaultSerializers.string;
  }, [initialFilters, serializers]);
  
  // Parse URL parameters with proper type handling
  const parseUrlParams = useCallback((): Partial<T> => {
    const params = new URLSearchParams(window.location.search);
    const result: any = {};
    
    params.forEach((value, key) => {
      if (key in initialFilters) {
        const serializer = getSerializer(key as keyof T);
        const decoded = serializer.decode(value);
        if (decoded !== undefined) {
          result[key] = decoded;
        }
      }
    });
    
    return result;
  }, [initialFilters, getSerializer]);
  
  // Update URL with filters
  const updateUrlParams = useCallback((filters: Partial<T>) => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        const serializer = getSerializer(key as keyof T);
        try {
          const encoded = serializer.encode(value);
          if (encoded) {
            params.set(key, encoded);
          }
        } catch (error) {
          console.warn(`Failed to serialize filter ${key}:`, error);
        }
      }
    });
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }, [getSerializer]);
  
  // Initialize filters from URL or use defaults
  const [filters, setFilters] = useState<T>(() => {
    if (syncWithUrl) {
      const urlFilters = parseUrlParams();
      // Merge URL filters with initial filters to preserve defaults
      return { ...initialFilters, ...urlFilters };
    }
    return initialFilters;
  });
  
  // Debounced URL update
  useEffect(() => {
    if (!syncWithUrl) return;
    
    const timer = setTimeout(() => {
      // Only sync non-default values to URL
      const activeFilters: Partial<T> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== initialFilters[key as keyof T]) {
          activeFilters[key as keyof T] = value;
        }
      });
      updateUrlParams(activeFilters);
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [filters, debounceMs, syncWithUrl, initialFilters, updateUrlParams]);
  
  // Sync from URL when location changes (browser back/forward)
  useEffect(() => {
    if (syncWithUrl) {
      const urlFilters = parseUrlParams();
      setFilters(prev => ({ ...initialFilters, ...urlFilters }));
    }
  }, [location, syncWithUrl, parseUrlParams, initialFilters]);
  
  // Update a single filter
  const updateFilter = useCallback(<K extends keyof T>(
    key: K,
    value: T[K] | undefined
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value !== undefined && value !== null && value !== "" 
        ? value 
        : initialFilters[key]
    }));
  }, [initialFilters]);
  
  // Clear a specific filter (reset to initial value)
  const clearFilter = useCallback(<K extends keyof T>(key: K) => {
    setFilters(prev => ({
      ...prev,
      [key]: initialFilters[key]
    }));
  }, [initialFilters]);
  
  // Clear all filters (reset to initial state)
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    if (syncWithUrl) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [initialFilters, syncWithUrl]);
  
  // Set all filters at once (useful for applying presets)
  const setAllFilters = useCallback((newFilters: Partial<T>) => {
    setFilters({ ...initialFilters, ...newFilters });
  }, [initialFilters]);
  
  // Check if there are any active filters (different from initial)
  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some(key => 
      filters[key as keyof T] !== initialFilters[key as keyof T]
    );
  }, [filters, initialFilters]);
  
  // Count active filters (different from initial)
  const activeFilterCount = useMemo(() => {
    return Object.keys(filters).filter(key => 
      filters[key as keyof T] !== initialFilters[key as keyof T]
    ).length;
  }, [filters, initialFilters]);
  
  return {
    filters,
    updateFilter,
    clearFilter,
    clearFilters,
    setAllFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
