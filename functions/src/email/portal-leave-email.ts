// =========================================================================
// 📧 Leave notification email template
//
// The card, details table and CTA come from ./layout — this file only decides
// the copy, the accent colour and which detail rows a given notification
// carries.
// =========================================================================

import {
  COLORS,
  PORTAL_DASHBOARD_URL,
  detailRow,
  escapeHtml,
  formatDecider,
  rejectionBlock,
  renderEmailShell,
  type Decider,
} from "./layout";

export {
  ADMIN_LEAVE_URL,
  APPROVER_ROLE_LABEL,
  PORTAL_APPROVAL_URL,
  PORTAL_DASHBOARD_URL,
} from "./layout";

/** One decided step of the approval chain, as stored in `leaves.approvals[]`. */
export type LeaveDecider = Decider;

/**
 * Who the mail is addressed to, which decides the heading, the lead line and
 * the call to action. 'approved' and 'rejected' are the applicant-facing
 * variants — both send the reader to their own dashboard rather than to an
 * approval queue.
 */
export type LeaveEmailType = "departmentHead" | "hr" | "approved" | "rejected";

export type LeaveEmailData = {
  leaveUserName?: string;
  type?: string;
  policyName?: string;
  duration?: number;
  startDate?: string;
  endDate?: string;
  reason?: string;
};

export type RenderLeaveEmailParams = {
  recipientName?: string;
  applicantName?: string;
  leave: LeaveEmailData;
  actionUrl: string;
  type: LeaveEmailType;
  rejectReason?: string;
  /** Who rejected — shown on the 'rejected' notice. */
  decidedBy?: LeaveDecider;
  /** Everyone who signed off — shown on the 'approved' notice. */
  approvers?: LeaveDecider[];
};

const HEADINGS: Record<LeaveEmailType, { title: string; lead: string; cta: string }> = {
  departmentHead: {
    title: "ມີໃບລາພັກໃໝ່ ລໍຖ້າການອະນຸມັດ",
    lead: "ມີພະນັກງານໃນຂອບເຂດຮັບຜິດຊອບຂອງທ່ານ ຍື່ນຄຳຮ້ອງຂໍລາພັກ ກະລຸນາກວດສອບ ແລະ ພິຈາລະນາ.",
    cta: "ກວດສອບ ແລະ ອະນຸມັດ",
  },
  hr: {
    title: "ໃບລາພັກ ຜ່ານຫົວໜ້າພະແນກແລ້ວ",
    lead: "ຫົວໜ້າພະແນກໄດ້ອະນຸມັດໃບລາພັກສະບັບນີ້ແລ້ວ ຂັ້ນຕໍ່ໄປລໍຖ້າການກວດສອບຈາກ ບໍລິຫານ ແລະ ບຸກຄະລາກອນ.",
    cta: "ກວດສອບ ແລະ ອະນຸມັດ",
  },
  approved: {
    title: "ໃບລາພັກຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ",
    lead: "ຄຳຮ້ອງຂໍລາພັກຂອງທ່ານຜ່ານການອະນຸມັດຄົບທຸກຂັ້ນຕອນແລ້ວ.",
    cta: "ກວດສອບໃນລະບົບ",
  },
  rejected: {
    title: "ໃບລາພັກຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ",
    lead: "ຂໍອະໄພ ຄຳຮ້ອງຂໍລາພັກຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ ລາຍລະອຽດຢູ່ດ້ານລຸ່ມ.",
    cta: "ກວດສອບໃນລະບົບ",
  },
};

/**
 * Builds the full HTML body for one leave notification.
 *
 * For the applicant-facing types the CTA always points at the portal
 * dashboard — the reader has nothing to approve — so `actionUrl` is ignored
 * there.
 */
export function renderLeaveEmailHtml(params: RenderLeaveEmailParams): string {
  const {
    recipientName,
    applicantName,
    leave,
    actionUrl,
    type,
    rejectReason,
    decidedBy,
    approvers,
  } = params;

  const isRejected = type === "rejected";
  const isApproved = type === "approved";
  // Applicant-facing notices have nothing to act on, so they always land on
  // the reader's own dashboard regardless of the caller's actionUrl.
  const isApplicantNotice = isRejected || isApproved;
  const copy = HEADINGS[type];
  const accent = isRejected
    ? COLORS.danger
    : isApproved
      ? COLORS.success
      : COLORS.brand;

  const applicant = applicantName || leave.leaveUserName || "ບໍ່ລະບຸ";
  const leaveType = leave.policyName || leave.type || "ບໍ່ລະບຸ";
  const duration = leave.duration != null ? `${leave.duration} ວັນ` : "ບໍ່ລະບຸ";
  const period =
    leave.startDate && leave.endDate
      ? `${leave.startDate} ຫາ ${leave.endDate}`
      : leave.startDate || leave.endDate || "ບໍ່ລະບຸ";

  // Who decided — the single rejecter, or the full chain of approvers. Shown
  // inside the details card so the applicant can see it without opening the
  // app; "ຈາກໃຜ" is the first thing they ask.
  let decisionRows = "";
  if (isRejected && decidedBy) {
    decisionRows = detailRow("ຜູ້ປະຕິເສດ", escapeHtml(formatDecider(decidedBy)), COLORS.danger);
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
    detailRow("ຜູ້ຍື່ນລາ", escapeHtml(applicant)) +
    "\n" +
    detailRow("ປະເພດການລາ", escapeHtml(leaveType)) +
    "\n" +
    detailRow("ຈຳນວນ", escapeHtml(duration)) +
    "\n" +
    detailRow("ໄລຍະເວລາ", escapeHtml(period)) +
    "\n" +
    detailRow("ເຫດຜົນ", escapeHtml(leave.reason || "ບໍ່ລະບຸ")) +
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
    ctaUrl: isApplicantNotice ? PORTAL_DASHBOARD_URL : actionUrl,
  });
}
