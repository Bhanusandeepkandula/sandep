import { useState, useMemo, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { T, card, inp, lbl } from "./config.js";
import {
  loadProfiles,
  saveProfiles,
  addProfile,
  upsertProfile,
  pinToPassword,
  isValidPin,
  makeLoginEmail,
  profileDisplayName,
  PENDING_LOGIN_EMAIL_KEY,
} from "./auth/pinProfiles.js";
import { useShellLayout } from "./useShellLayout.js";

export default function AuthGate() {
  const { shellMax, px: padX, safeBottom } = useShellLayout();
  const [profiles, setProfiles] = useState(loadProfiles);
  const [tab, setTab] = useState(() => (loadProfiles().length ? "signin" : "signup"));
  const [label, setLabel] = useState("");
  const [pin, setPin] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(() => loadProfiles()[0]?.email || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [remoteEmail, setRemoteEmail] = useState("");

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
      setTab("signin");
      setSelectedEmail(email);
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/operation-not-allowed") {
        setErr("Account sign-in is disabled. In Firebase Console → Authentication → Sign-in method, enable Email/Password (the app uses it only in the background).");
      } else {
        setErr(e?.message || String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoteSignIn(e) {
    e?.preventDefault?.();
    setErr("");
    const email = remoteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setErr("Enter your account email (from Profile on your other device, looks like u_…@pin.track.app).");
      return;
    }
    if (!isValidPin(pin)) {
      setErr("Enter your 4-digit PIN.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pinToPassword(pin));
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No user after sign-in");
      const snap = await getDoc(doc(db, "users", uid, "settings", "app"));
      let name = "User";
      let uuid = "";
      if (snap.exists()) {
        const d = snap.data() || {};
        if (typeof d.profileName === "string" && d.profileName.trim()) name = d.profileName.trim();
        if (typeof d.appProfileUuid === "string" && d.appProfileUuid.trim()) uuid = d.appProfileUuid.trim();
      }
      if (!uuid) {
        uuid =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        await setDoc(
          doc(db, "users", uid, "settings", "app"),
          { budgets: {}, people: [], profileName: name, profileEmail: "", appProfileUuid: uuid },
          { merge: true }
        );
      }
      upsertProfile({ email, name, uuid, pin, createdAt: Date.now() });
      refreshProfiles();
      setSelectedEmail(email);
      setPin("");
      setRemoteEmail("");
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErr("Wrong PIN or account email.");
      } else if (code === "auth/user-not-found") {
        setErr("No account for that email. Check the address or use Sign up on this device.");
      } else if (code === "auth/operation-not-allowed") {
        setErr("Email/Password sign-in is disabled in Firebase Console.");
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

  const px = padX;

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        maxWidth: shellMax,
        margin: "0 auto",
        boxSizing: "border-box",
        background: T.bg,
        color: T.txt,
        fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        paddingLeft: px,
        paddingRight: px,
        paddingTop: `calc(${px + 24}px + env(safe-area-inset-top, 0px))`,
        paddingBottom: `max(40px, ${safeBottom})`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 13, color: T.acc, fontWeight: 700, marginBottom: 8 }}>Track expense</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>Who&apos;s using this device?</div>
      <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, marginBottom: 28 }}>
        {tab === "signup" ? (
          <>
            Choose <strong style={{ color: T.txt }}>Sign up</strong> to enter your display name and a PIN. We create a private cloud account for you—no email address to type.
          </>
        ) : (
          <>
            Pick your profile and enter your PIN. On a <strong style={{ color: T.txt }}>new device</strong> with no profiles here, use <strong style={{ color: T.txt }}>Sign-in ID</strong> (from Profile on your old device) plus PIN below.
          </>
        )}
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
        <form
          autoComplete="off"
          onSubmit={(e) => void handleCreate(e)}
          style={{ ...card, marginBottom: 0 }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Create your profile</div>
          <label style={lbl}>Your name</label>
          <input
            name="displayName"
            autoComplete="name"
            autoCapitalize="words"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Sandeep"
            style={{ ...inp, marginBottom: 14 }}
          />
          <label style={lbl}>Choose a 4-digit PIN</label>
          <input
            name="appPin"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
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
            {busy ? "Creating…" : "Continue"}
          </button>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 12, lineHeight: 1.45 }}>
            PIN protects your data. Your display name is saved on this device for quick switching.
          </div>
        </form>
      ) : null}

      {tab === "signin" && profiles.length === 0 ? (
        <form autoComplete="off" onSubmit={(e) => void handleRemoteSignIn(e)} style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Already have an account on another device?</div>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.45 }}>
            Paste your <strong style={{ color: T.txt }}>Sign-in ID</strong> from Profile on the other device (starts with <code style={{ color: T.acc }}>u_</code>), then your PIN.
          </div>
          <label style={lbl}>Sign-in ID</label>
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            value={remoteEmail}
            onChange={(e) => setRemoteEmail(e.target.value)}
            placeholder="u_…@pin.track.app"
            style={{ ...inp, marginBottom: 14, fontSize: 14, fontFamily: "ui-monospace,monospace" }}
          />
          <label style={lbl}>4-digit PIN</label>
          <input
            inputMode="numeric"
            autoComplete="current-password"
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
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 14, lineHeight: 1.5 }}>
            New here? Open <strong style={{ color: T.txt }}>Sign up</strong> to create a profile on this device.
          </div>
        </form>
      ) : null}
    </div>
  );
}
