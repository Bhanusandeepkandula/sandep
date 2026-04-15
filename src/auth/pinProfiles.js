/**
 * Device-local list of app profiles. Each profile maps to a Firebase Auth user
 * (synthetic email + PIN-derived password) so Firestore stays `users/{uid}/...`.
 *
 * Each profile has a stable appProfileUuid for tagging transactions (separate from Firebase Auth uid).
 */

export const PROFILES_STORAGE_KEY = "track_pin_profiles_v1";
export const PENDING_LOGIN_EMAIL_KEY = "track_pending_login_email";

/** Suffix keeps Firebase password length ≥ 6; never shown to the user. */
export const PIN_PASSWORD_SUFFIX = "!TrkXp#v1";

export function pinToPassword(pin) {
  const digits = String(pin).replace(/\D/g, "").slice(0, 4);
  return `${digits}${PIN_PASSWORD_SUFFIX}`;
}

export function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}

export function makeLoginEmail() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `u_${id}@pin.track.app`;
}

export function profileDisplayName(p) {
  if (!p) return "Profile";
  return (p.name || p.label || "User").trim() || "User";
}

export function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const o = JSON.parse(raw);
    if (!Array.isArray(o.profiles)) return [];
    let changed = false;
    const normalized = o.profiles.filter((p) => p && typeof p.email === "string" && p.email.trim()).map((p) => {
      const email = p.email.trim();
      const name = (p.name || p.label || "User").trim() || "User";
      let uuid = typeof p.uuid === "string" && p.uuid.trim() ? p.uuid.trim() : "";
      if (!uuid) {
        uuid =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        changed = true;
      }
      const pin = typeof p.pin === "string" ? p.pin : "";
      if (!p.uuid || (p.label && !p.name)) changed = true;
      return { name, email, uuid, pin, createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now() };
    });
    if (changed) saveProfiles(normalized);
    return normalized;
  } catch {
    return [];
  }
}

export function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify({ profiles }));
}

export function addProfile(profile) {
  const next = loadProfiles();
  next.push({
    uuid: profile.uuid,
    email: profile.email,
    name: profile.name,
    pin: profile.pin ?? "",
    createdAt: profile.createdAt ?? Date.now(),
  });
  saveProfiles(next);
}
