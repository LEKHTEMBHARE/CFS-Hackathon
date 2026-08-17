import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function saveUserProfile(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getSubmission(uid) {
  const ref = doc(db, "submissions", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function saveSubmission(uid, data) {
  const ref = doc(db, "submissions", uid);
  const payload = {
    ...data,
    uid,
    updatedAt: serverTimestamp(),
    ...(data.status === "submitted" ? { submittedAt: serverTimestamp() } : {}),
  };
  await setDoc(ref, payload, { merge: true });
}

export async function fetchAllSubmissions() {
  const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
}

export async function fetchSubmissionsByStatus(status) {
  const q = query(
    collection(db, "submissions"),
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
}

export async function getAllUsers() {
  const q = query(collection(db, "users"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
}
