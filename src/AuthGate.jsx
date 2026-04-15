import { useState, useMemo, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { T, card, inp, lbl } from "./config.js";
import {
  loadProfiles,
  saveProfiles,
  addProfile,
  pinToPassword,
  isValidPin,
  makeLoginEmail,
  profileDisplayName,
  PENDING_LOGIN_EMAIL_KEY,
} from "./auth/pinProfiles.js";

export default function AuthGate() {
  const [profiles, setProfiles] = useState(loadProfiles);
  const [tab, setTab] = useState(() => (loadProfiles().length ? "signin" : "signup"));
  const [label, setLabel] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(() => loadProfiles()[0]?.email || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_LOGIN_EMAIL_KEY);
      if (pending && profiles.some((p) => p.email === pending)) {
        setSelectedEmail(pending);
        setTab("signin");
        sessionStorage.removeItem(PENDING_LOGIN_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [profiles]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.email === selectedEmail) || null,
    [profiles, selectedEmail]
  );

  const selectedLabel = profileDisplayName(selectedProfile);

  function refreshProfiles() {
    const p = loadProfiles();
    setProfiles(p);
    if (p.length && !p.some((x) => x.email === selectedEmail)) {
      setSelectedEmail(p[0].email);
    }
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    setErr("");
    if (!label.trim()) {
      setErr("Enter your name for this device.");
      return;
    }
    if (!isValidPin(pin)) {
      setErr("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== pin2) {
      setErr("PIN and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const email = makeLoginEmail();
      const profileUuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const name = label.trim();
      await createUserWithEmailAndPassword(auth, email, pinToPassword(pin));
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No user after sign-up");
      addProfile({ uuid: profileUuid, email, name, pin });
      await setDoc(
        doc(db, "users", uid, "settings", "app"),
        {
          budgets: {},
          people: [],
          profileName: name,
          profileEmail: "",
          appProfileUuid: profileUuid,
        },
        { merge: true }
      );
      refreshProfiles();
      setLabel("");
      setPin("");
      setPin2("");
      setTab("signin");
      setSelectedEmail(email);
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/operation-not-allowed") {
        setErr("Email/Password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e) {
    e?.preventDefault?.();
    setErr("");
    if (!selectedEmail) {
      setErr("Choose a profile or create one.");
      return;
    }
    if (!isValidPin(pin)) {
      setErr("Enter your 4-digit PIN.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, selectedEmail, pinToPassword(pin));
      const list = loadProfiles();
      const idx = list.findIndex((x) => x.email === selectedEmail);
      if (idx >= 0 && pin) {
        const copy = [...list];
        copy[idx] = { ...copy[idx], pin };
        saveProfiles(copy);
        setProfiles(copy);
      }
      setPin("");
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErr("Wrong PIN for this profile.");
      } else if (code === "auth/operation-not-allowed") {
        setErr("Email/Password sign-in is disabled in Firebase Console.");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  const px = 20;

  return (
    <div
      style={{
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        background: T.bg,
        color: T.txt,
        fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        padding: `${px + 24}px ${px}px 40px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 13, color: T.acc, fontWeight: 700, marginBottom: 8 }}>Track expense</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>Who&apos;s using this device?</div>
      <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, marginBottom: 28 }}>
        Same catalog for everyone. Each person has a UUID and their own expenses under their account. Names and PINs are stored on this device to switch users quickly.
      </div>

      <div
        role="tablist"
        aria-label="Authentication"
        style={{
          display: "flex",
          marginBottom: 20,
          borderRadius: T.r,
          overflow: "hidden",
          border: `1px solid ${T.bdr}`,
          background: T.card2,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signin"}
          onClick={() => {
            setTab("signin");
            setErr("");
          }}
          style={{
            flex: 1,
            padding: "12px 14px",
            border: "none",
            borderRight: `1px solid ${T.bdr}`,
            background: tab === "signin" ? T.adim : "transparent",
            color: tab === "signin" ? T.acc : T.sub,
            fontWeight: 800,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          onClick={() => {
            setTab("signup");
            setErr("");
          }}
          style={{
            flex: 1,
            padding: "12px 14px",
            border: "none",
            background: tab === "signup" ? T.adim : "transparent",
            color: tab === "signup" ? T.acc : T.sub,
            fontWeight: 800,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Sign up
        </button>
      </div>

      {err ? (
        <div
          style={{
            ...card,
            marginBottom: 16,
            borderColor: "rgba(239,68,68,0.35)",
            background: T.ddim,
            color: T.dng,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {err}
        </div>
      ) : null}

      {tab === "signin" && profiles.length > 0 ? (
        <form onSubmit={(e) => void handleLogin(e)} style={{ ...card, marginBottom: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Profile</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {profiles.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => {
                  setSelectedEmail(p.email);
                  setErr("");
                }}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: T.r,
                  border: selectedEmail === p.email ? `2px solid ${T.acc}` : `1px solid ${T.bdr}`,
                  background: selectedEmail === p.email ? T.adim : T.card2,
                  color: T.txt,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: selectedEmail === p.email ? 700 : 500,
                }}
              >
                <div>{profileDisplayName(p)}</div>
                <div style={{ fontSize: 11, color: T.mut, marginTop: 4, fontFamily: "ui-monospace,monospace" }}>
                  {p.uuid ? `${p.uuid.slice(0, 8)}…` : "—"}
                </div>
              </button>
            ))}
          </div>
          <label style={lbl}>4-digit PIN for {selectedLabel}</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ ...inp, marginBottom: 18, letterSpacing: 8, fontSize: 22, fontWeight: 800 }}
          />
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: T.r,
              background: busy ? T.mut : T.acc,
              border: "none",
              color: "#000",
              fontSize: 16,
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Unlock"}
          </button>
        </form>
      ) : null}

      {tab === "signup" ? (
        <form onSubmit={(e) => void handleCreate(e)} style={{ ...card, marginBottom: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Create a profile</div>
          <label style={lbl}>Your name</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Sandeep"
            style={{ ...inp, marginBottom: 14 }}
          />
          <label style={lbl}>4-digit PIN</label>
          <input
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ ...inp, marginBottom: 14, letterSpacing: 8, fontSize: 22, fontWeight: 800 }}
          />
          <label style={lbl}>Confirm PIN</label>
          <input
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ ...inp, marginBottom: 18, letterSpacing: 8, fontSize: 22, fontWeight: 800 }}
          />
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: T.r,
              background: busy ? T.mut : T.acc,
              border: "none",
              color: "#000",
              fontSize: 16,
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Creating…" : "Create & sign in"}
          </button>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 12, lineHeight: 1.45 }}>
            PIN + name are saved on this device for switching. Enable Email/Password in Firebase Authentication.
          </div>
        </form>
      ) : null}

      {tab === "signin" && profiles.length === 0 ? (
        <div style={{ ...card, color: T.sub, fontSize: 14, lineHeight: 1.5 }}>
          No profile on this device yet. Open the <strong style={{ color: T.txt }}>Sign up</strong> tab to create one.
        </div>
      ) : null}
    </div>
  );
}
