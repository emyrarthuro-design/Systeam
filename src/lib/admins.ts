export const SUPER_ADMIN_EMAILS = [
  'emyr.arthuro@gmail.com'
];

export const ADMIN_EMAILS = [
  'info@emyrarthuro.com'
];

export function isAnyAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email) || ADMIN_EMAILS.includes(email);
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email);
}
