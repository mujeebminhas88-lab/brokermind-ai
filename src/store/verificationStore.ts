/**
 * Verification Store — human-in-the-loop document verification.
 *
 * Tracks every ingested document with per-field confidence scores and a
 * lifecycle status: uploaded → pending → review → verified.
 */
import { create } from "zustand";
import type { DocumentKind, FieldSpec } from "@/utils/documentRegistry";

export type DocStatus = "uploaded" | "pending" | "review" | "verified";

export interface FieldEntry {
  name: string;
  label: string;
  type: FieldSpec["type"];
  value: string | number | boolean;
  confidence: number; // 0-100
}

export interface VerificationDoc {
  id: string;
  kind: DocumentKind;
  label: string;
  uploadedAt: number;
  status: DocStatus;
  mandatory: boolean;
  fields: FieldEntry[];
  verifiedAt?: number;
}

interface State {
  docs: VerificationDoc[];
  addDoc: (d: Omit<VerificationDoc, "id" | "uploadedAt" | "status"> & { status?: DocStatus }) => string;
  updateField: (id: string, name: string, value: string | number | boolean) => void;
  setStatus: (id: string, status: DocStatus) => void;
  verify: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useVerificationStore = create<State>((set) => ({
  docs: [],
  addDoc: (d) => {
    const id = uid();
    set((s) => ({
      docs: [
        ...s.docs,
        {
          id,
          uploadedAt: Date.now(),
          status: d.status ?? "pending",
          ...d,
        } as VerificationDoc,
      ],
    }));
    return id;
  },
  updateField: (id, name, value) =>
    set((s) => ({
      docs: s.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              fields: d.fields.map((f) => (f.name === name ? { ...f, value, confidence: 100 } : f)),
            }
          : d,
      ),
    })),
  setStatus: (id, status) =>
    set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, status } : d)) })),
  verify: (id) =>
    set((s) => ({
      docs: s.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              status: "verified",
              verifiedAt: Date.now(),
              fields: d.fields.map((f) => ({ ...f, confidence: 100 })),
            }
          : d,
      ),
    })),
  remove: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
  clear: () => set({ docs: [] }),
}));

export function docHasReviewRequired(d: VerificationDoc): boolean {
  return d.fields.some((f) => f.confidence < 95);
}

/** Deterministic pseudo-confidence per field so re-renders don't jitter. */
export function seedConfidence(kind: string, fieldName: string): number {
  let h = 0;
  const s = `${kind}::${fieldName}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  // Range 78–99
  return 78 + (h % 22);
}
