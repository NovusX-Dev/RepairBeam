import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";

// Helper to parse URL search params
function parseUrlParams<T extends Record<string, any>>(): Partial<T> {
  const params = new URLSearchParams(window.location.search);
  const result: any = {};
  
  params.forEach((value, key) => {
    try {
      // Try to parse as JSON first (for complex types)
      result[key] = JSON.parse(value);
    } catch {
      // If parsing fails, use the string value
      result[key] = value;
    }
  });
  
  return result;
}

// Helper to update URL with filters
function updateUrlParams<T extends Record<string, any>>(filters: Partial<T>) {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      // For objects/arrays, stringify them
      const stringValue = typeof value === 'object' 
        ? JSON.stringify(value) 
        : String(value);
      params.set(key, stringValue);
    }
  });
  
  const newUrl = params.toString() 
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  
  window.history.replaceState({}, '', newUrl);
}

interface UseFilterStateOptions {
  debounceMs?: number;
  syncWithUrl?: boolean;
}

export function useFilterState<T extends Record<string, any>>(
  initialFilters: T,
  options: UseFilterStateOptions = {}
) {
  const { debounceMs = 300, syncWithUrl = true } = options;
  const [location] = useLocation();
  
  // Initialize filters from URL if syncWithUrl is enabled
  const [filters, setFilters] = useState<Partial<T>>(() => {
    if (syncWithUrl) {
      const urlFilters = parseUrlParams<T>();
      return Object.keys(urlFilters).length > 0 ? urlFilters : initialFilters;
    }
    return initialFilters;
  });
  
  // Debounced URL update
  useEffect(() => {
    if (!syncWithUrl) return;
    
    const timer = setTimeout(() => {
      updateUrlParams(filters);
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [filters, debounceMs, syncWithUrl]);
  
  // Sync from URL when location changes (e.g., browser back/forward)
  useEffect(() => {
    if (syncWithUrl) {
      const urlFilters = parseUrlParams<T>();
      if (Object.keys(urlFilters).length > 0) {
        setFilters(urlFilters);
      }
    }
  }, [location, syncWithUrl]);
  
  // Update a single filter
  const updateFilter = useCallback(<K extends keyof T>(
    key: K,
    value: T[K] | undefined
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === undefined || value === null || value === "") {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      return newFilters;
    });
  }, []);
  
  // Clear a specific filter
  const clearFilter = useCallback(<K extends keyof T>(key: K) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    if (syncWithUrl) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [syncWithUrl]);
  
  // Check if there are any active filters
  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).length > 0;
  }, [filters]);
  
  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.keys(filters).length;
  }, [filters]);
  
  return {
    filters,
    updateFilter,
    clearFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
