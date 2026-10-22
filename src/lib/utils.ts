import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Fusionne des classes Tailwind sans doublons contradictoires (utilisé par les composants Kokonut UI)
export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}
