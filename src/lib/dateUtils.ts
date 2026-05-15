export const parseDate = (d: any): Date | null => {
  if (!d) return null;
  if (d.toDate && typeof d.toDate === 'function') return d.toDate();
  if (d.seconds) return new Date(d.seconds * 1000);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (d: any): string => {
  const date = parseDate(d);
  if (!date) return '—';
  return date.toLocaleDateString();
};

export const formatDateTime = (d: any): string => {
  const date = parseDate(d);
  if (!date) return '—';
  return date.toLocaleString();
};

export const formatIso = (d: any): string => {
  const date = parseDate(d);
  if (!date) return '';
  return date.toISOString();
};
