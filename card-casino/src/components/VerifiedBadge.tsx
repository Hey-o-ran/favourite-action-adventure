/**
 * A blue check shown next to an admin's name, like the verified mark on social sites, so nobody can pass
 * themselves off as an admin. It only appears where the server says the person is one.
 */
export function VerifiedBadge() {
  return (
    <svg className="verified-badge" viewBox="0 0 24 24" role="img" aria-label="Verified admin" width="1.1em" height="1.1em">
      <title>Verified admin</title>
      <circle cx="12" cy="12" r="11" fill="#1d9bf0" />
      <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
