import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn convention: cn() merges tailwind classes resolving conflicts.
// Required by every shadcn component. SSOT remains DESIGN.md — this is just
// the className composer, not a token policy escape hatch.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
