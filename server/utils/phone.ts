/**
 * Phone number formatting utilities for SMS sending.
 * Ensures phone numbers are in international format for Twilio.
 */

/**
 * Formats a phone number with the default country code if not already in international format.
 * 
 * @param phoneNumber - The phone number to format (e.g., "11987654321" or "+5511987654321")
 * @param defaultCountryCode - The default country code to prefix (e.g., "+55" for Brazil)
 * @returns The phone number in international format (e.g., "+5511987654321")
 */
export function formatPhoneWithCountryCode(
  phoneNumber: string,
  defaultCountryCode: string = '+55'
): string {
  if (!phoneNumber) {
    return phoneNumber;
  }

  // Remove any spaces, dashes, parentheses
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

  // If already starts with +, assume it's already in international format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If starts with 00 (international dialing prefix), convert to +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }

  // Ensure country code starts with +
  const normalizedCountryCode = defaultCountryCode.startsWith('+') 
    ? defaultCountryCode 
    : '+' + defaultCountryCode;

  // Prefix with country code
  return normalizedCountryCode + cleaned;
}

/**
 * Validates if a phone number looks valid for SMS sending.
 * 
 * @param phoneNumber - The phone number to validate
 * @returns true if the phone number appears valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) {
    return false;
  }

  // Remove formatting characters
  const cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

  // Must be at least 10 digits (DDD + number for Brazil)
  // and no more than 15 digits (E.164 max)
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return false;
  }

  // If starts with +, validate it has digits after
  if (cleaned.startsWith('+')) {
    return digitsOnly.length >= 10;
  }

  return true;
}
