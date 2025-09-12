/**
 * Money utilities for precise currency calculations using integer cents
 * Eliminates floating point precision issues by using integer arithmetic
 */

export type Locale = 'en' | 'pt-BR';

/**
 * Convert a currency string to integer cents
 * @param input Currency string (e.g., "754", "754.00", "754,50" for pt-BR)
 * @param locale Locale for decimal separator handling
 * @returns Integer cents value (e.g., 75400 for $754.00)
 */
export function toCents(input: string | number, locale: Locale = 'en'): number {
  if (typeof input === 'number') {
    input = input.toString();
  }
  
  // Remove any whitespace and currency symbols
  let cleanInput = input.toString().trim().replace(/[$€£¥₹]/g, '');
  
  // Handle locale-specific decimal separators
  if (locale === 'pt-BR') {
    // In Brazilian Portuguese, comma is decimal separator
    // Replace comma with dot for parsing
    cleanInput = cleanInput.replace(',', '.');
  }
  
  // Parse as float and convert to cents
  const value = parseFloat(cleanInput) || 0;
  
  // Round to avoid floating point precision issues
  return Math.round(value * 100);
}

/**
 * Convert integer cents to formatted currency string
 * @param cents Integer cents value (e.g., 75400)
 * @param locale Locale for formatting
 * @returns Formatted currency string (e.g., "754.00")
 */
export function fromCents(cents: number, locale: Locale = 'en'): string {
  const value = cents / 100;
  
  if (locale === 'pt-BR') {
    // Brazilian format: 754,50
    return value.toFixed(2).replace('.', ',');
  }
  
  // Default format: 754.00
  return value.toFixed(2);
}

/**
 * Add multiple cent values together
 * @param centValues Array of cent values to add
 * @returns Sum in cents
 */
export function addCents(...centValues: number[]): number {
  return centValues.reduce((sum, cents) => sum + cents, 0);
}

/**
 * Subtract one cent value from another
 * @param minuend Value to subtract from
 * @param subtrahend Value to subtract
 * @returns Difference in cents
 */
export function subtractCents(minuend: number, subtrahend: number): number {
  return minuend - subtrahend;
}

/**
 * Multiply cents by a decimal rate
 * @param cents Cents value to multiply
 * @param rate Decimal rate (e.g., 0.1 for 10%, 1.15 for 115%)
 * @returns Result in cents, properly rounded
 */
export function mulCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}

/**
 * Calculate percentage of cents value
 * @param cents Base cents value
 * @param percentage Percentage (e.g., 10 for 10%)
 * @returns Percentage amount in cents
 */
export function percentageCents(cents: number, percentage: number): number {
  return Math.round(cents * (percentage / 100));
}

/**
 * Normalize currency string to standard 2-decimal format
 * @param input Currency input
 * @param locale Locale for formatting
 * @returns Normalized currency string
 */
export function normalizeCurrency(input: string | number, locale: Locale = 'en'): string {
  const cents = toCents(input, locale);
  return fromCents(cents, locale);
}

/**
 * Check if two currency values are equal (handles precision issues)
 * @param value1 First currency value
 * @param value2 Second currency value
 * @param locale Locale for parsing
 * @returns True if values are equal
 */
export function currencyEquals(value1: string | number, value2: string | number, locale: Locale = 'en'): boolean {
  return toCents(value1, locale) === toCents(value2, locale);
}

/**
 * Format cents as currency for display with currency symbol
 * @param cents Integer cents value
 * @param locale Locale for formatting
 * @param currency Currency code (default: USD for en, BRL for pt-BR)
 * @returns Formatted currency string with symbol
 */
export function formatCurrency(cents: number, locale: Locale = 'en', currency?: string): string {
  const value = cents / 100;
  
  if (locale === 'pt-BR') {
    const currencyCode = currency || 'BRL';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  const currencyCode = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}