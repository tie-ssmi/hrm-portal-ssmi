"use strict";
// =========================================================================
// 👥 Work-outside (offsite) status-email recipients
//
// The two terminal states route differently on purpose:
//   approved → every teammate on the trip, so the whole party knows it is on
//   rejected → the requester alone; a refusal is between the approver and the
//              person who asked for it, not team-wide news
// =========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOffsiteTeammateRecipients = resolveOffsiteTeammateRecipients;
exports.resolveOffsiteRequesterRecipient = resolveOffsiteRequesterRecipient;
function normalizeEmail(value) {
    if (typeof value !== "string")
        return null;
    const email = value.trim().toLowerCase();
    return email.includes("@") ? email : null;
}
function personName(person) {
    var _a, _b;
    return ((_a = person.fullNameLo) === null || _a === void 0 ? void 0 : _a.trim()) || ((_b = person.fullNameEn) === null || _b === void 0 ? void 0 : _b.trim()) || person.email || "";
}
/**
 * Everyone listed in `teammate[]`, de-duplicated by address.
 *
 * Note this is the teammate array as stored, which does NOT include the
 * requester — the offsite form keeps the requester in `requester` and in
 * `participantIds`, but adds only the people they picked to `teammate[]`.
 */
function resolveOffsiteTeammateRecipients(doc) {
    var _a;
    const seen = new Set();
    const recipients = [];
    for (const teammate of (_a = doc.teammate) !== null && _a !== void 0 ? _a : []) {
        const email = normalizeEmail(teammate === null || teammate === void 0 ? void 0 : teammate.email);
        if (!email || seen.has(email))
            continue;
        seen.add(email);
        recipients.push({ email, name: personName(teammate !== null && teammate !== void 0 ? teammate : {}) });
    }
    return recipients;
}
/**
 * The requester alone. Prefers the address denormalised onto the document at
 * submission time and falls back to the employees collection, since an
 * employee whose address changed later would otherwise be mailed at the stale
 * one — or not at all, if the document predates the `requester.email` field.
 */
async function resolveOffsiteRequesterRecipient(db, doc) {
    var _a, _b, _c, _d;
    const denormalized = normalizeEmail((_a = doc.requester) === null || _a === void 0 ? void 0 : _a.email);
    if (denormalized) {
        return {
            email: denormalized,
            name: personName((_b = doc.requester) !== null && _b !== void 0 ? _b : {}) || doc.createdBy || "",
        };
    }
    const uid = doc.createdByUid || ((_c = doc.requester) === null || _c === void 0 ? void 0 : _c.uid);
    if (!uid)
        return null;
    // Document id first (this repo's convention), then the `uid` field for the
    // legacy documents whose id doesn't match it.
    let data;
    const direct = await db.collection("employees").doc(uid).get();
    if (direct.exists) {
        data = direct.data();
    }
    else {
        const byField = await db
            .collection("employees")
            .where("uid", "==", uid)
            .limit(1)
            .get();
        data = (_d = byField.docs[0]) === null || _d === void 0 ? void 0 : _d.data();
    }
    const email = normalizeEmail(data === null || data === void 0 ? void 0 : data.email);
    if (!email)
        return null;
    const lo = [data === null || data === void 0 ? void 0 : data.firstNameLo, data === null || data === void 0 ? void 0 : data.lastNameLo].filter(Boolean).join(" ").trim();
    const en = [data === null || data === void 0 ? void 0 : data.firstNameEn, data === null || data === void 0 ? void 0 : data.lastNameEn].filter(Boolean).join(" ").trim();
    return { email, name: lo || en || doc.createdBy || email };
}
//# sourceMappingURL=offsite-recipient-resolver.js.map