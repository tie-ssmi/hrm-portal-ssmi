// =========================================================================
// 📧 Work-outside (offsite) status email template
//
// Status notifications only — the "your request was decided" mails. The
// approved notice goes to the teammates on the trip; the rejected notice goes
// to the requester alone (a rejection is between the approver and the person
// who asked, not something the whole team needs).
// =========================================================================

import {
  COLORS,
  PORTAL_REQUEST_OFFSITE_URL,
  detailRow,
  escapeHtml,
  formatDecider,
  rejectionBlock,
  renderEmailShell,
  type Decider,
} from "./layout";

export {
  ADMIN_OFFSITE_URL,
  PORTAL_APPROVAL_OFFSITE_URL,
  PORTAL_REQUEST_OFFSITE_URL,
} from "./layout";

export type OffsiteDecider = Decider;

/**
 * 'departmentHead' asks someone to act (CTA → the approval queue); 'approved'
 * and 'rejected' only report an outcome (CTA → the reader's dashboard).
 */
export type OffsiteEmailType = "departmentHead" | "approved" | "rejected";

export type OffsiteEmailData = {
  requestNo?: string;
  requesterName?: string;
  activityTypeName?: string;
  subject?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  teammateCount?: number;
};

export type RenderOffsiteEmailParams = {
  recipientName?: string;
  offsite: OffsiteEmailData;
  actionUrl: string;
  type: OffsiteEmailType;
  rejectReason?: string;
  /** Who rejected — shown on the 'rejected' notice. */
  decidedBy?: OffsiteDecider;
  /** Everyone who signed off — shown on the 'approved' notice. */
  approvers?: OffsiteDecider[];
};

const HEADINGS: Record<OffsiteEmailType, { title: string; lead: string; cta: string }> = {
  departmentHead: {
    title: "ມີໃບສະເໜີອອກວຽກນອກໃໝ່ ລໍຖ້າການອະນຸມັດ",
    lead: "ມີພະນັກງານໃນຂອບເຂດຮັບຜິດຊອບຂອງທ່ານ ຍື່ນໃບສະເໜີອອກວຽກນອກ ກະລຸນາກວດສອບ ແລະ ພິຈາລະນາ.",
    cta: "ກວດສອບ ແລະ ອະນຸມັດ",
  },
  approved: {
    title: "ໃບສະເໜີອອກວຽກນອກ ໄດ້ຮັບການອະນຸມັດແລ້ວ",
    lead: "ໃບສະເໜີອອກວຽກນອກທີ່ທ່ານມີສ່ວນຮ່ວມ ຜ່ານການອະນຸມັດຄົບທຸກຂັ້ນຕອນແລ້ວ.",
    cta: "ກວດສອບໃນລະບົບ",
  },
  rejected: {
    title: "ໃບສະເໜີອອກວຽກນອກ ບໍ່ໄດ້ຮັບການອະນຸມັດ",
    lead: "ຂໍອະໄພ ໃບສະເໜີອອກວຽກນອກຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ ລາຍລະອຽດຢູ່ດ້ານລຸ່ມ.",
    cta: "ກວດສອບໃນລະບົບ",
  },
};

/**
 * Builds the full HTML body for one offsite notification.
 *
 * The two outcome types are recipient-facing notices with nothing to act on,
 * so their CTA is forced to the requester's own offsite list; only
 * 'departmentHead' — which asks for a decision — follows the caller's
 * `actionUrl`.
 */
export function renderOffsiteEmailHtml(params: RenderOffsiteEmailParams): string {
  const { recipientName, offsite, actionUrl, type, rejectReason, decidedBy, approvers } =
    params;

  const isRejected = type === "rejected";
  const isApproved = type === "approved";
  const isOutcomeNotice = isRejected || isApproved;
  const copy = HEADINGS[type];
  const accent = isRejected
    ? COLORS.danger
    : isApproved
      ? COLORS.success
      : COLORS.brand;

  const period =
    offsite.startDate && offsite.endDate
      ? `${offsite.startDate} ຫາ ${offsite.endDate}`
      : offsite.startDate || offsite.endDate || "ບໍ່ລະບຸ";
  const duration =
    offsite.durationDays != null ? `${offsite.durationDays} ມື້` : "ບໍ່ລະບຸ";

  let decisionRows = "";
  if (isRejected && decidedBy) {
    decisionRows = detailRow(
      "ຜູ້ປະຕິເສດ",
      escapeHtml(formatDecider(decidedBy)),
      COLORS.danger,
    );
  } else if (isApproved && approvers && approvers.length > 0) {
    decisionRows = approvers
      .map((approver, index) =>
        detailRow(
          index === 0 ? "ຜູ້ອະນຸມັດ" : "",
          escapeHtml(formatDecider(approver)),
          COLORS.success,
        ),
      )
      .join("");
  }

  const detailRows =
    detailRow("ເລກທີໃບສະເໜີ", escapeHtml(offsite.requestNo || "ບໍ່ລະບຸ")) +
    "\n" +
    detailRow("ຜູ້ສະເໜີ", escapeHtml(offsite.requesterName || "ບໍ່ລະບຸ")) +
    "\n" +
    detailRow("ປະເພດກິດຈະກຳ", escapeHtml(offsite.activityTypeName || "ບໍ່ລະບຸ")) +
    "\n" +
    detailRow("ຫົວຂໍ້", escapeHtml(offsite.subject || "ບໍ່ລະບຸ")) +
    "\n" +
    detailRow("ໄລຍະເວລາ", escapeHtml(period)) +
    "\n" +
    detailRow("ຈຳນວນມື້", escapeHtml(duration)) +
    "\n" +
    decisionRows;

  return renderEmailShell({
    title: copy.title,
    lead: copy.lead,
    greetingName: recipientName ? escapeHtml(recipientName) : undefined,
    accent,
    detailRows,
    extraBlock: isRejected ? rejectionBlock(rejectReason) : "",
    ctaLabel: copy.cta,
    ctaUrl: isOutcomeNotice
      ? PORTAL_REQUEST_OFFSITE_URL
      : actionUrl || PORTAL_REQUEST_OFFSITE_URL,
  });
}
