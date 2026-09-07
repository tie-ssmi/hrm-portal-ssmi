"use strict";
// =========================================================================
// 📧 Leave notification email template
//
// The card, details table and CTA come from ./layout — this file only decides
// the copy, the accent colour and which detail rows a given notification
// carries.
// =========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORTAL_DASHBOARD_URL = exports.PORTAL_APPROVAL_URL = exports.APPROVER_ROLE_LABEL = exports.ADMIN_LEAVE_URL = void 0;
exports.renderLeaveEmailHtml = renderLeaveEmailHtml;
const layout_1 = require("./layout");
var layout_2 = require("./layout");
Object.defineProperty(exports, "ADMIN_LEAVE_URL", { enumerable: true, get: function () { return layout_2.ADMIN_LEAVE_URL; } });
Object.defineProperty(exports, "APPROVER_ROLE_LABEL", { enumerable: true, get: function () { return layout_2.APPROVER_ROLE_LABEL; } });
Object.defineProperty(exports, "PORTAL_APPROVAL_URL", { enumerable: true, get: function () { return layout_2.PORTAL_APPROVAL_URL; } });
Object.defineProperty(exports, "PORTAL_DASHBOARD_URL", { enumerable: true, get: function () { return layout_2.PORTAL_DASHBOARD_URL; } });
const HEADINGS = {
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
function renderLeaveEmailHtml(params) {
    const { recipientName, applicantName, leave, actionUrl, type, rejectReason, decidedBy, approvers, } = params;
    const isRejected = type === "rejected";
    const isApproved = type === "approved";
    // Applicant-facing notices have nothing to act on, so they always land on
    // the reader's own dashboard regardless of the caller's actionUrl.
    const isApplicantNotice = isRejected || isApproved;
    const copy = HEADINGS[type];
    const accent = isRejected
        ? layout_1.COLORS.danger
        : isApproved
            ? layout_1.COLORS.success
            : layout_1.COLORS.brand;
    const applicant = applicantName || leave.leaveUserName || "ບໍ່ລະບຸ";
    const leaveType = leave.policyName || leave.type || "ບໍ່ລະບຸ";
    const duration = leave.duration != null ? `${leave.duration} ວັນ` : "ບໍ່ລະບຸ";
    const period = leave.startDate && leave.endDate
        ? `${leave.startDate} ຫາ ${leave.endDate}`
        : leave.startDate || leave.endDate || "ບໍ່ລະບຸ";
    // Who decided — the single rejecter, or the full chain of approvers. Shown
    // inside the details card so the applicant can see it without opening the
    // app; "ຈາກໃຜ" is the first thing they ask.
    let decisionRows = "";
    if (isRejected && decidedBy) {
        decisionRows = (0, layout_1.detailRow)("ຜູ້ປະຕິເສດ", (0, layout_1.escapeHtml)((0, layout_1.formatDecider)(decidedBy)), layout_1.COLORS.danger);
    }
    else if (isApproved && approvers && approvers.length > 0) {
        decisionRows = approvers
            .map((approver, index) => (0, layout_1.detailRow)(index === 0 ? "ຜູ້ອະນຸມັດ" : "", (0, layout_1.escapeHtml)((0, layout_1.formatDecider)(approver)), layout_1.COLORS.success))
            .join("");
    }
    const detailRows = (0, layout_1.detailRow)("ຜູ້ຍື່ນລາ", (0, layout_1.escapeHtml)(applicant)) +
        "\n" +
        (0, layout_1.detailRow)("ປະເພດການລາ", (0, layout_1.escapeHtml)(leaveType)) +
        "\n" +
        (0, layout_1.detailRow)("ຈຳນວນ", (0, layout_1.escapeHtml)(duration)) +
        "\n" +
        (0, layout_1.detailRow)("ໄລຍະເວລາ", (0, layout_1.escapeHtml)(period)) +
        "\n" +
        (0, layout_1.detailRow)("ເຫດຜົນ", (0, layout_1.escapeHtml)(leave.reason || "ບໍ່ລະບຸ")) +
        "\n" +
        decisionRows;
    return (0, layout_1.renderEmailShell)({
        title: copy.title,
        lead: copy.lead,
        greetingName: recipientName ? (0, layout_1.escapeHtml)(recipientName) : undefined,
        accent,
        detailRows,
        extraBlock: isRejected ? (0, layout_1.rejectionBlock)(rejectReason) : "",
        ctaLabel: copy.cta,
        ctaUrl: isApplicantNotice ? layout_1.PORTAL_DASHBOARD_URL : actionUrl,
    });
}
//# sourceMappingURL=portal-leave-email.js.map