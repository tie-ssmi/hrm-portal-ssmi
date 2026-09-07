"use strict";
// =========================================================================
// 📧 Work-outside (offsite) status email template
//
// Status notifications only — the "your request was decided" mails. The
// approved notice goes to the teammates on the trip; the rejected notice goes
// to the requester alone (a rejection is between the approver and the person
// who asked, not something the whole team needs).
// =========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORTAL_REQUEST_OFFSITE_URL = exports.PORTAL_APPROVAL_OFFSITE_URL = exports.ADMIN_OFFSITE_URL = void 0;
exports.renderOffsiteEmailHtml = renderOffsiteEmailHtml;
const layout_1 = require("./layout");
var layout_2 = require("./layout");
Object.defineProperty(exports, "ADMIN_OFFSITE_URL", { enumerable: true, get: function () { return layout_2.ADMIN_OFFSITE_URL; } });
Object.defineProperty(exports, "PORTAL_APPROVAL_OFFSITE_URL", { enumerable: true, get: function () { return layout_2.PORTAL_APPROVAL_OFFSITE_URL; } });
Object.defineProperty(exports, "PORTAL_REQUEST_OFFSITE_URL", { enumerable: true, get: function () { return layout_2.PORTAL_REQUEST_OFFSITE_URL; } });
const HEADINGS = {
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
function renderOffsiteEmailHtml(params) {
    const { recipientName, offsite, actionUrl, type, rejectReason, decidedBy, approvers } = params;
    const isRejected = type === "rejected";
    const isApproved = type === "approved";
    const isOutcomeNotice = isRejected || isApproved;
    const copy = HEADINGS[type];
    const accent = isRejected
        ? layout_1.COLORS.danger
        : isApproved
            ? layout_1.COLORS.success
            : layout_1.COLORS.brand;
    const period = offsite.startDate && offsite.endDate
        ? `${offsite.startDate} ຫາ ${offsite.endDate}`
        : offsite.startDate || offsite.endDate || "ບໍ່ລະບຸ";
    const duration = offsite.durationDays != null ? `${offsite.durationDays} ມື້` : "ບໍ່ລະບຸ";
    let decisionRows = "";
    if (isRejected && decidedBy) {
        decisionRows = (0, layout_1.detailRow)("ຜູ້ປະຕິເສດ", (0, layout_1.escapeHtml)((0, layout_1.formatDecider)(decidedBy)), layout_1.COLORS.danger);
    }
    else if (isApproved && approvers && approvers.length > 0) {
        decisionRows = approvers
            .map((approver, index) => (0, layout_1.detailRow)(index === 0 ? "ຜູ້ອະນຸມັດ" : "", (0, layout_1.escapeHtml)((0, layout_1.formatDecider)(approver)), layout_1.COLORS.success))
            .join("");
    }
    const detailRows = (0, layout_1.detailRow)("ເລກທີໃບສະເໜີ", (0, layout_1.escapeHtml)(offsite.requestNo || "ບໍ່ລະບຸ")) +
        "\n" +
        (0, layout_1.detailRow)("ຜູ້ສະເໜີ", (0, layout_1.escapeHtml)(offsite.requesterName || "ບໍ່ລະບຸ")) +
        "\n" +
        (0, layout_1.detailRow)("ປະເພດກິດຈະກຳ", (0, layout_1.escapeHtml)(offsite.activityTypeName || "ບໍ່ລະບຸ")) +
        "\n" +
        (0, layout_1.detailRow)("ຫົວຂໍ້", (0, layout_1.escapeHtml)(offsite.subject || "ບໍ່ລະບຸ")) +
        "\n" +
        (0, layout_1.detailRow)("ໄລຍະເວລາ", (0, layout_1.escapeHtml)(period)) +
        "\n" +
        (0, layout_1.detailRow)("ຈຳນວນມື້", (0, layout_1.escapeHtml)(duration)) +
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
        ctaUrl: isOutcomeNotice
            ? layout_1.PORTAL_REQUEST_OFFSITE_URL
            : actionUrl || layout_1.PORTAL_REQUEST_OFFSITE_URL,
    });
}
//# sourceMappingURL=portal-offsite-email.js.map