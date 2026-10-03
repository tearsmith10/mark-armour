import { ID_TYPES, type IdType } from "./types";

/**
 * Age & identity verification rules shared by the checkout form (UX) and the
 * checkout API (authoritative). The demo validates format + age locally; a
 * production deployment should additionally route the document through an ID
 * verification provider (e.g. Stripe Identity / Persona / Onfido).
 */

export const ID_TYPE_VALUES: string[] = ID_TYPES.map((t) => t.value);

export function ageFromDob(dob: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() + 1 < month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

const PATTERNS: Record<string, RegExp> = {
  passport: /^[A-Za-z0-9]{6,17}$/,
  drivers_license: /^[A-Za-z0-9][A-Za-z0-9 -]{4,24}$/,
  badge: /^[A-Za-z0-9][A-Za-z0-9-]{3,23}$/,
  ssn: /^\d{3}-?\d{2}-?\d{4}$/,
  national_id: /^[A-Za-z0-9][A-Za-z0-9-]{3,23}$/,
};

export type VerificationInput = {
  dob?: string;
  idType?: string;
  idNumber?: string;
};

export type VerificationResult =
  | { ok: true; age: number; idType: IdType; idNumberMasked: string; dob: string }
  | { ok: false; error: string };

export function validateVerification(input: VerificationInput): VerificationResult {
  const dob = String(input.dob ?? "").trim();
  const idType = String(input.idType ?? "").trim();
  const idNumber = String(input.idNumber ?? "").trim();

  const age = ageFromDob(dob);
  if (age === null) {
    return { ok: false, error: "Enter your date of birth (YYYY-MM-DD)." };
  }
  if (age < 18) {
    return { ok: false, error: "You must be 18 years or older to purchase." };
  }
  if (!ID_TYPE_VALUES.includes(idType)) {
    return { ok: false, error: "Choose the identity document type." };
  }
  const pattern = PATTERNS[idType];
  if (!pattern || !pattern.test(idNumber)) {
    return {
      ok: false,
      error:
        idType === "ssn"
          ? "Enter a valid SSN (123-45-6789)."
          : "Enter a valid document number (4–25 letters, digits, spaces or dashes).",
    };
  }

  return {
    ok: true,
    age,
    idType: idType as IdType,
    dob,
    idNumberMasked: maskIdNumber(idType, idNumber),
  };
}

/** Evidence stored on the order: document type + last four only. */
export function maskIdNumber(idType: string, raw: string): string {
  const clean = raw.replace(/[\s-]/g, "");
  const last4 = clean.slice(-4);
  if (idType === "ssn") {
    const d = raw.replace(/[^\d]/g, "");
    return `•••-••-${d.slice(-4) || last4}`;
  }
  return `••••••${last4}`;
}
