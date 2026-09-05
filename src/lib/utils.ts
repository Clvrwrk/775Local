import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

/** tel: link for a 10-digit or E.164 US number. */
export function telHref(phone: string) {
  const d = phone.replace(/\D/g, "");
  return `tel:+${d.length === 10 ? `1${d}` : d}`;
}

/** Maps search link that opens the native maps app on phones and the web on desktop. */
export function mapsHref(parts: { street?: string | null; city: string; zip?: string | null }) {
  const query = [parts.street, `${parts.city}, NV`, parts.zip].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
