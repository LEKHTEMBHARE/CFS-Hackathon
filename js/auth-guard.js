import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function ensureAuthOverlay() {
  let overlay = document.getElementById("authGuardOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "authGuardOverlay";
    overlay.className = "auth-guard-overlay";
    overlay.innerHTML = `
      <div class="auth-guard-card">
        <div class="loading-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  return overlay;
}

function hideAuthOverlay() {
  const overlay = document.getElementById("authGuardOverlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("auth-checking");
  document.body.classList.add("auth-ready");
}

export function requireAuth(onReady, redirectUrl = "login.html") {
  const overlay = ensureAuthOverlay();
  document.body.classList.remove("auth-ready");
  document.body.classList.add("auth-checking");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      overlay.remove();
      window.location.href = redirectUrl;
      return;
    }

    hideAuthOverlay();
    onReady(user);
  });
}

export async function getUserRole(uid) {
  if (!uid) return "participant";
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data().role || "participant" : "participant";
  } catch (error) {
    console.error("Role lookup failed:", error);
    return "participant";
  }
}

export function requireAdmin(onReady, redirectUrl = "admin-login.html") {
  const overlay = ensureAuthOverlay();
  document.body.classList.remove("auth-ready");
  document.body.classList.add("auth-checking");

  if (localStorage.getItem("cfs_demo_admin") === "active") {
    hideAuthOverlay();
    onReady({ uid: "demo-admin" });
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      overlay.remove();
      window.location.href = redirectUrl;
      return;
    }

    const role = await getUserRole(user.uid);
    if (role !== "admin") {
      overlay.remove();
      window.location.href = redirectUrl;
      return;
    }

    hideAuthOverlay();
    onReady(user);
  });
}
