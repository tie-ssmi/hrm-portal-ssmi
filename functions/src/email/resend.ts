// =========================================================================
// 📧 Resend transactional email — REST API via native fetch
//
// Lives in Cloud Functions, not the portal: the portal is a static export
// (next.config.mjs `output: 'export'`) with no server, so any key it used
// would have to be NEXT_PUBLIC_* and ship inside the JS bundle. Resend also
// rejects browser-origin requests outright.
//
// Every function here is failure-tolerant by contract: email is a courtesy
// on top of a Firestore write that has already succeeded, so a delivery
// problem is logged and swallowed. Nothing in this file ever throws.
// =========================================================================

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Must be a domain verified in the Resend dashboard, or the API rejects
// every send with a 403.
const DEFAULT_FROM = "SSMI HRM <noreply@ssmilaos.com>";

export type SendEmailParams = {
  to: string[];
  subject: string;
  html: string;
  /** Short label used to prefix log lines, e.g. "leave-new". */
  tag: string;
};

/**
 * Sends one email through Resend. Resolves to true only when Resend accepted
 * the message; every other outcome (missing key, no recipients, network
 * error, non-2xx response) resolves to false after logging.
 */
export async function sendResendEmail(params: SendEmailParams): Promise<boolean> {
  const { to, subject, html, tag } = params;

  const recipients = to.filter((address) => !!address && address.includes("@"));
  if (recipients.length === 0) {
    console.log(`[email ${tag}]: no recipients resolved — skipped`);
    return false;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[email ${tag}]: RESEND_API_KEY is not set — skipped`);
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to: recipients,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      // Read the body for the reason — Resend returns a JSON error object
      // whose `message` names the actual problem (unverified domain, bad
      // key, invalid recipient).
      const detail = await response.text().catch(() => "<unreadable body>");
      console.error(
        `[email ${tag}]: Resend returned ${response.status} — ${detail}`,
      );
      return false;
    }

    console.log(`[email ${tag}]: sent to ${recipients.length} recipient(s)`);
    return true;
  } catch (error) {
    console.error(`[email ${tag}]: send failed —`, error);
    return false;
  }
}
