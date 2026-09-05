/** Clean a phone number to digits-only for WhatsApp/tel links. */
export function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/** WhatsApp link: wa.me/<digits> */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${cleanPhone(phone)}`;
}

/** Tel link: tel:<phone> */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

/** Simple deterministic hash for demo password storage. Not cryptographically secure. */
export function hashPassword(password: string): string {
  // SHA-1 via SubtleCrypto is async; use a simple deterministic hash for demo.
  let hash = 0;
  const salted = `pf_${password}`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  // Convert to hex-like string, matching seed format
  const hex = Math.abs(hash).toString(16);
  return `pf_${hex.padStart(8, '0')}`;
}

/** Format currency in Pakistani style (Rs. with Lacs/Crore) */
export function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    const crore = amount / 10000000;
    const formatted = crore % 1 === 0 ? crore.toFixed(0) : crore.toFixed(2);
    return `Rs. ${formatted} Crore`;
  }
  if (amount >= 100000) {
    const lacs = amount / 100000;
    const formatted = lacs % 1 === 0 ? lacs.toFixed(0) : lacs.toFixed(2);
    return `Rs. ${formatted} Lacs`;
  }
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}

/** Format date for display */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format date+time for display */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Convert ISO string to value for datetime-local input */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

/** Relative time (e.g. "2h ago") */
export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}
