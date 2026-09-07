// =========================================================================
// 👥 Work-outside (offsite) status-email recipients
//
// The two terminal states route differently on purpose:
//   approved → every teammate on the trip, so the whole party knows it is on
//   rejected → the requester alone; a refusal is between the approver and the
//              person who asked for it, not team-wide news
// =========================================================================

export type OffsiteTeammate = {
  uid?: string;
  email?: string;
  fullNameLo?: string;
  fullNameEn?: string;
};

export type OffsiteRecipientSource = {
  createdByUid?: string;
  createdBy?: string;
  requester?: {
    uid?: string;
    email?: string;
    fullNameLo?: string;
    fullNameEn?: string;
  };
  teammate?: OffsiteTeammate[];
};

export type EmailRecipient = {
  email: string;
  name: string;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function personName(person: {
  fullNameLo?: string;
  fullNameEn?: string;
  email?: string;
}): string {
  return person.fullNameLo?.trim() || person.fullNameEn?.trim() || person.email || "";
}

/**
 * Everyone listed in `teammate[]`, de-duplicated by address.
 *
 * Note this is the teammate array as stored, which does NOT include the
 * requester — the offsite form keeps the requester in `requester` and in
 * `participantIds`, but adds only the people they picked to `teammate[]`.
 */
export function resolveOffsiteTeammateRecipients(
  doc: OffsiteRecipientSource,
): EmailRecipient[] {
  const seen = new Set<string>();
  const recipients: EmailRecipient[] = [];

  for (const teammate of doc.teammate ?? []) {
    const email = normalizeEmail(teammate?.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email, name: personName(teammate ?? {}) });
  }

  return recipients;
}

/**
 * The requester alone. Prefers the address denormalised onto the document at
 * submission time and falls back to the employees collection, since an
 * employee whose address changed later would otherwise be mailed at the stale
 * one — or not at all, if the document predates the `requester.email` field.
 */
export async function resolveOffsiteRequesterRecipient(
  db: FirebaseFirestore.Firestore,
  doc: OffsiteRecipientSource,
): Promise<EmailRecipient | null> {
  const denormalized = normalizeEmail(doc.requester?.email);
  if (denormalized) {
    return {
      email: denormalized,
      name: personName(doc.requester ?? {}) || doc.createdBy || "",
    };
  }

  const uid = doc.createdByUid || doc.requester?.uid;
  if (!uid) return null;

  // Document id first (this repo's convention), then the `uid` field for the
  // legacy documents whose id doesn't match it.
  let data: FirebaseFirestore.DocumentData | undefined;
  const direct = await db.collection("employees").doc(uid).get();
  if (direct.exists) {
    data = direct.data();
  } else {
    const byField = await db
      .collection("employees")
      .where("uid", "==", uid)
      .limit(1)
      .get();
    data = byField.docs[0]?.data();
  }

  const email = normalizeEmail(data?.email);
  if (!email) return null;

  const lo = [data?.firstNameLo, data?.lastNameLo].filter(Boolean).join(" ").trim();
  const en = [data?.firstNameEn, data?.lastNameEn].filter(Boolean).join(" ").trim();

  return { email, name: lo || en || doc.createdBy || email };
}
