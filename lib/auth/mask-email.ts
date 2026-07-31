// Auth UX Hardening milestone. "The destination email, safely displayed" -
// shows enough of the address for the founder to confirm it's the right
// inbox without rendering the full address in a screen that may be visible
// to someone glancing at the screen (or, per the milestone's mobile
// scenarios, when the OTP screen is reached via a shared/public device).

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;

  const maskedLocal =
    local.length <= 2 ? `${local[0] ?? ""}*` : `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 1))}`;

  const [domainName, ...domainRest] = domain.split(".");
  const maskedDomainName =
    domainName.length <= 1 ? domainName : `${domainName[0]}${"*".repeat(domainName.length - 1)}`;

  return `${maskedLocal}@${[maskedDomainName, ...domainRest].join(".")}`;
}
