/**
 * Mirrors split expenses to linked friends' Firestore accounts so both parties see the same bill.
 *
 * How peer resolution works (priority order):
 *   1. p.fuid — Firebase UID embedded directly in QR (most reliable, no lookup needed)
 *   2. peerProfileIndex[p.u] — UUID → Firebase UID global index (fallback for old QR codes)
 *
 * Both users only need to scan each other's QR once. After that, splits work instantly.
 */
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { normalizePerson } from "./splitContactShare.js";

export const PEER_PROFILE_INDEX = "peerProfileIndex";

function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Attach profile ids from split contacts so we can resolve peers in Firestore.
 * Copies u (appProfileUuid), e (email), and fuid (Firebase UID) from the contacts list.
 * Also preserves any u/e/fuid already on the person object.
 */
export function enrichSplitPeopleFromContacts(split, contactsArr) {
  if (!split?.people?.length) return split;
  const contacts = (contactsArr || []).map(normalizePerson).filter((p) => p.n);
  return {
    ...split,
    people: split.people.map((p) => {
      const pName = String(p.n || "").trim().toLowerCase();
      const n = String(p.n || "").trim();
      const a = typeof p.a === "number" && Number.isFinite(p.a) ? p.a : parseFloat(String(p.a)) || 0;

      // Exact match first, then prefix / partial match fallback
      const c =
        contacts.find((x) => x.n.toLowerCase() === pName) ||
        contacts.find(
          (x) => x.n.toLowerCase().startsWith(pName) || pName.startsWith(x.n.toLowerCase())
        );

      const out = { n, a };
      // fuid (Firebase UID) — highest priority for mirror writes
      const fuid = c?.fuid || p.fuid;
      if (fuid) out.fuid = fuid;
      // u (appProfileUuid) — fallback lookup key
      const u = c?.u || p.u;
      if (u) out.u = u;
      // e (email) — informational
      const e = c?.e || p.e;
      if (e) out.e = e;
      return out;
    }),
  };
}

/** Publish mapping appProfileUuid → Firebase uid so friends can mirror transactions to this account. */
export async function publishPeerProfileIndex(db, firebaseUid, appProfileUuid) {
  const id = String(appProfileUuid || "").trim();
  if (!id || !firebaseUid) return;
  try {
    await setDoc(doc(db, PEER_PROFILE_INDEX, id), { uid: firebaseUid, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error("publishPeerProfileIndex", e);
  }
}

export async function resolvePeerUid(db, appProfileUuid) {
  const id = String(appProfileUuid || "").trim();
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, PEER_PROFILE_INDEX, id));
    const u = snap.data()?.uid;
    return typeof u === "string" && u.trim().length ? u.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Firebase UIDs of peers linked via split people.
 * Uses fuid (Firebase UID) directly when available — no Firestore lookup needed.
 * Falls back to peerProfileIndex[u] for old QR codes that don't have fuid.
 */
export async function collectPeerUidsForSplit(db, split, ownerUid) {
  if (!split?.people?.length) return [];
  const seen = new Set();
  const out = [];
  for (const p of split.people) {
    let peerUid = null;

    // Path 1: fuid embedded in contact from new QR (no lookup needed)
    const fuid = typeof p.fuid === "string" ? p.fuid.trim() : "";
    if (fuid) {
      peerUid = fuid;
    } else {
      // Path 2: UUID → peerProfileIndex lookup (old QR codes / manually-added contacts)
      const uuid = typeof p.u === "string" ? p.u.trim() : "";
      if (!uuid) {
        console.warn("splitPeerSync: no fuid or u on person, cannot mirror:", p.n);
        continue;
      }
      peerUid = await resolvePeerUid(db, uuid);
      if (!peerUid) {
        console.warn("splitPeerSync: could not resolve peer UID for:", p.n, "uuid:", uuid);
        continue;
      }
    }

    if (peerUid !== ownerUid && !seen.has(peerUid)) {
      seen.add(peerUid);
      out.push(peerUid);
    }
  }
  return out;
}

/** Peer copy: same fields; receipt stays on payer's Storage — omit for peers (rules / ACL). */
export function buildMirrorTransaction(tx, syncedFromUid) {
  const copy = { ...tx, syncedFromUid };
  if (copy.receiptUrl) delete copy.receiptUrl;
  return copy;
}

export async function upsertSplitMirrors(db, ownerUid, tx) {
  const result = { attempted: 0, succeeded: 0, failed: 0, unresolved: [], peerUids: [], permissionDenied: false };
  if (!tx?.id || !tx?.split?.people?.length) return result;

  // Track people without any resolution path
  const unresolvedNames = [];
  for (const p of tx.split.people) {
    const hasFuid = typeof p.fuid === "string" && p.fuid.trim();
    const hasUuid = typeof p.u === "string" && p.u.trim();
    if (!hasFuid && !hasUuid) unresolvedNames.push(p.n || "(unnamed)");
  }

  const peers = await collectPeerUidsForSplit(db, tx.split, ownerUid);
  result.unresolved = unresolvedNames;
  if (!peers.length) return result;

  const mirror = buildMirrorTransaction(tx, ownerUid);
  const payload = sanitize(mirror);

  for (const peerUid of peers) {
    result.attempted += 1;
    try {
      /* merge:true is critical — without it, every master edit completely
       * overwrites the peer's mirror doc and wipes their `settlement` field,
       * silently un-settling bills on the slave side. With merge:true the
       * master's edits land on top of any existing settlement / local
       * metadata the slave has attached. */
      await setDoc(doc(db, "users", peerUid, "transactions", tx.id), payload, { merge: true });
      result.succeeded += 1;
      result.peerUids.push(peerUid);
    } catch (e) {
      result.failed += 1;
      if (e?.code === "permission-denied" || String(e?.message).includes("insufficient permissions")) {
        result.permissionDenied = true;
      }
      console.error("upsertSplitMirrors failed for peer:", peerUid, e);
    }
  }
  return result;
}

/** Remove mirrored copies from peers' libraries (before updating split or deleting the expense). */
export async function deleteMirrorsForOwnerTransaction(db, ownerUid, tx) {
  if (!tx?.id) return;
  const peers = await collectPeerUidsForSplit(db, tx.split, ownerUid);
  if (!peers.length) return;
  const batch = writeBatch(db);
  for (const peerUid of peers) {
    batch.delete(doc(db, "users", peerUid, "transactions", tx.id));
  }
  try {
    await batch.commit();
  } catch (e) {
    console.error("deleteMirrorsForOwnerTransaction", e);
  }
}
