// =========================================================================
// 📧 Shared email chrome — the card, the details table, the CTA
//
// Table-based layout with everything inlined: Gmail, Outlook and the Lao
// mobile mail clients strip <style> blocks and ignore flex/grid, so the
// structure has to survive on attributes and inline styles alone.
//
// Both the leave and the offsite templates render through renderEmailShell so
// the two families of notification stay visually identical; only the detail
// rows and the copy differ.
// =========================================================================

// The approval page opens on its leave tab and reads ?tab= to switch (see
// app/dashboard/approv/page.tsx) — so the offsite link must carry it, or a
// departmentHead following an offsite mail lands on the leave queue.
// `trailingSlash: true` in next.config.mjs makes /approv/ the canonical path.

/** Portal approval page, leave tab — where a departmentHead acts on a leave request. */
export const PORTAL_APPROVAL_URL = "https://hrmapp.ssmilaos.com/dashboard/approv/";
/** Portal approval page, offsite tab — where a departmentHead acts on an offsite request. */
export const PORTAL_APPROVAL_OFFSITE_URL =
  "https://hrmapp.ssmilaos.com/dashboard/approv/?tab=offsite";
/** Admin approval page — where HR picks a leave request up next. */
export const ADMIN_LEAVE_URL = "https://hrm.ssmilaos.com/leave";
/** Admin approval page — where HR and the manager pick an offsite request up next. */
export const ADMIN_OFFSITE_URL = "https://hrm.ssmilaos.com/outside-work";
/** Portal dashboard — where a leave applicant checks their own request. */
export const PORTAL_DASHBOARD_URL = "https://hrmapp.ssmilaos.com/dashboard";
/**
 * Portal "my requests" page, offsite tab — where a requester or teammate
 * checks a decided offsite request. Like the approval page it opens on its
 * leave tab, so the ?tab= is what lands the reader on the right list
 * (app/dashboard/request/page.tsx).
 */
export const PORTAL_REQUEST_OFFSITE_URL =
  "https://hrmapp.ssmilaos.com/dashboard/request/?tab=offsite";

export const FONT_STACK = "'Phetsarath OT', 'Noto Sans Lao', Arial, sans-serif";

export const COLORS = {
  pageBg: "#f4f5f7",
  cardBg: "#ffffff",
  cardBorder: "#e4e6eb",
  detailBg: "#f8f9fb",
  text: "#1f2430",
  muted: "#6b7280",
  brand: "#1d4ed8",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  success: "#16a34a",
  successBg: "#f0fdf4",
  successBorder: "#bbf7d0",
};

/** Lao labels for the approval slots, used when naming who decided. */
export const APPROVER_ROLE_LABEL: Record<string, string> = {
  departmentHead: "ຫົວໜ້າພະແນກ",
  hr: "ບໍລິຫານ ແລະ ບຸກຄະລາກອນ",
  manager: "ຜູ້ຈັດການ",
};

/** One decided step of an approval chain, as stored in `approvals[]`. */
export type Decider = {
  role?: string;
  name?: string;
  /** ISO timestamp or YYYY-MM-DD — only the date part is shown. */
  at?: string;
};

/**
 * Email bodies carry free text a colleague typed (leave reason, rejection
 * reason, names). Escaping is what keeps a stray `<` or `&` from breaking the
 * markup — and an injected tag out of the message.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One label/value line of the details card. `value` must already be escaped. */
export function detailRow(
  label: string,
  value: string,
  valueColor = COLORS.text,
): string {
  return `
              <tr>
                <td style="padding:7px 0;vertical-align:top;white-space:nowrap;color:${COLORS.muted};font-size:14px;">${escapeHtml(label)}</td>
                <td style="padding:7px 0 7px 16px;vertical-align:top;color:${valueColor};font-size:14px;font-weight:600;">${value}</td>
              </tr>`;
}

/** `reviewedAt` is stored as either an ISO timestamp or a plain YYYY-MM-DD. */
export function decisionDate(at?: string): string {
  if (!at) return "";
  return at.slice(0, 10);
}

/** "ຫົວໜ້າພະແນກ — ສົມສັກ (2026-09-04)", degrading gracefully as parts go missing. */
export function formatDecider(decider: Decider): string {
  const role = decider.role ? APPROVER_ROLE_LABEL[decider.role] ?? decider.role : "";
  const name = decider.name ?? "";
  const date = decisionDate(decider.at);

  const who = [role, name].filter(Boolean).join(" — ");
  if (!who) return date ? date : "ບໍ່ລະບຸ";
  return date ? `${who} (${date})` : who;
}

/** The red "why was this rejected" panel, or nothing when there is no reason. */
export function rejectionBlock(reason?: string): string {
  if (!reason) return "";
  return `
          <tr>
            <td style="padding:0 28px 4px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.dangerBg};border:1px solid ${COLORS.dangerBorder};border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;font-family:${FONT_STACK};">
                    <div style="color:${COLORS.danger};font-size:13px;font-weight:700;margin-bottom:4px;">ເຫດຜົນການປະຕິເສດ</div>
                    <div style="color:${COLORS.danger};font-size:14px;line-height:1.6;">${escapeHtml(reason)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export type EmailShellParams = {
  /** Heading and <title>. Escaped here. */
  title: string;
  /** Sentence under the greeting. Escaped here. */
  lead: string;
  /** Recipient's name, already escaped, or undefined for a generic "ທ່ານ". */
  greetingName?: string;
  /** Top rule and CTA/button colour. */
  accent: string;
  /** Pre-rendered `detailRow(...)` output. */
  detailRows: string;
  /** Optional panel between the details card and the CTA — e.g. rejectionBlock. */
  extraBlock?: string;
  ctaLabel: string;
  ctaUrl: string;
};

/** Wraps pre-rendered rows in the shared card, header, CTA and footer. */
export function renderEmailShell(params: EmailShellParams): string {
  const { title, lead, greetingName, accent, detailRows, extraBlock, ctaLabel, ctaUrl } =
    params;

  return `<!DOCTYPE html>
<html lang="lo">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.pageBg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${COLORS.cardBg};border:1px solid ${COLORS.cardBorder};border-radius:12px;overflow:hidden;">

          <tr>
            <td style="height:4px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:26px 28px 6px 28px;font-family:${FONT_STACK};">
              <div style="color:${COLORS.muted};font-size:12px;letter-spacing:.6px;text-transform:uppercase;">SSMI HRM</div>
              <h1 style="margin:8px 0 0 0;color:${COLORS.text};font-size:20px;line-height:1.45;font-weight:700;">${escapeHtml(title)}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 28px 0 28px;font-family:${FONT_STACK};color:${COLORS.text};font-size:15px;line-height:1.7;">
              <p style="margin:0 0 6px 0;">ຮຽນ ${greetingName ?? "ທ່ານ"},</p>
              <p style="margin:0;color:${COLORS.muted};font-size:14px;">${escapeHtml(lead)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 4px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.detailBg};border:1px solid ${COLORS.cardBorder};border-radius:8px;">
                <tr>
                  <td style="padding:6px 18px;font-family:${FONT_STACK};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${extraBlock ?? ""}
          <tr>
            <td align="center" style="padding:22px 28px 6px 28px;font-family:${FONT_STACK};">
              <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener" style="display:inline-block;background-color:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 30px;border-radius:8px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:4px 28px 24px 28px;font-family:${FONT_STACK};">
              <div style="color:${COLORS.muted};font-size:12px;line-height:1.6;">ຫຼື ເປີດລິ້ງນີ້: <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener" style="color:${accent};word-break:break-all;">${escapeHtml(ctaUrl)}</a></div>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px;border-top:1px solid ${COLORS.cardBorder};font-family:${FONT_STACK};">
              <div style="color:${COLORS.muted};font-size:12px;line-height:1.6;">ອີເມວສະບັບນີ້ຖືກສົ່ງອັດຕະໂນມັດຈາກລະບົບ SSMI HRM — ກະລຸນາຢ່າຕອບກັບ.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
