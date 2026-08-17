import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ user: null, role: null, loading: false });
      return;
    }

    try {
      const docRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(docRef);
      const role = snapshot.exists() ? snapshot.data().role || "participant" : "participant";
      callback({ user, role, loading: false });
    } catch (error) {
      console.error("Auth role lookup failed:", error);
      callback({ user, role: "participant", loading: false });
    }
  });
}

export async function logoutUser() {
  await signOut(auth);
}

export function redirectIfLoggedIn(page) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const snap = await getDoc(docRef);
          const role = snap.exists() ? snap.data().role : "participant";
          window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
        } catch (error) {
          window.location.href = "dashboard.html";
        }
      } else {
        resolve();
      }
    });
  });
}
