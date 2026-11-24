import { nanoid } from "nanoid";

/** Client-side temporary ids (form rows). Server owns real ids after API create. */
export function createClientId(): string {
  return nanoid();
}

export function nowIso(): string {
  return new Date().toISOString();
}
