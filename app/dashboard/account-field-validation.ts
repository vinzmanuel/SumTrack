export const PH_MOBILE_REGEX = /^09\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAccountContactNo(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidPhilippineMobile(value: string) {
  return PH_MOBILE_REGEX.test(value);
}

export function normalizeAccountEmail(value: string) {
  return value.trim().slice(0, 120);
}

export function isValidEmailAddress(value: string) {
  return EMAIL_REGEX.test(value);
}
