import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Junta as regras de aparência (cores, tamanhos) de um elemento, resolvendo conflitos entre elas.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
