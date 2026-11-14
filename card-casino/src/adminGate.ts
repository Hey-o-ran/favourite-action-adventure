/**
 * The extra password in front of the admin page.
 *
 * Only a SHA-256 fingerprint of the password is kept here, so the password itself is not in the source code
 * or the published site. This is a speed bump, not real security: anyone can read the page's code and
 * work around it. What actually protects the admin tools is that the server checks the account is an admin.
 */
export const ADMIN_PASSWORD_SHA256 = '9c209022a679cfbf75fda01a5ce1ed88e27863b08779c864d73ec9b6f6f76e1f';

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True if `attempt` is the admin password. */
export async function checkAdminPassword(attempt: string): Promise<boolean> {
  return (await sha256Hex(attempt)) === ADMIN_PASSWORD_SHA256;
}
