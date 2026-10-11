const REGISTRATION_NOTICE_KEY = 'medisur.registration';

export function saveRegistrationNotice(email: string): void {
  try {
    window.sessionStorage.setItem(
      REGISTRATION_NOTICE_KEY,
      JSON.stringify({ success: true, email: email.trim().toLowerCase() }),
    );
  } catch {
    // Optional feedback must not prevent navigation when browser storage is unavailable.
  }
}

export async function consumeRegistrationNotice(): Promise<string | null> {
  try {
    const raw = window.sessionStorage.getItem(REGISTRATION_NOTICE_KEY);
    window.sessionStorage.removeItem(REGISTRATION_NOTICE_KEY);
    if (!raw) return null;
    const notice: unknown = JSON.parse(raw);
    if (
      !notice ||
      typeof notice !== 'object' ||
      !('success' in notice) ||
      notice.success !== true ||
      !('email' in notice) ||
      typeof notice.email !== 'string'
    )
      return null;
    const email = notice.email.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
  } catch {
    return null;
  }
}
