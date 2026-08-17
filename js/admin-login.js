import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "../components/ui.js";

const DEMO_ADMIN = {
  email: "admin@cfs.local",
  password: "CFSadmin123",
};

const form = document.getElementById("adminLoginForm");
const btn = document.getElementById("adminLoginBtn");
const emailInput = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");

const redirectIfLoggedIn = async () => {
  if (localStorage.getItem("cfs_demo_admin") === "active") {
    window.location.href = "admin.html";
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const role = snap.exists() ? snap.data().role || "participant" : "participant";

  if (role === "admin") {
    window.location.href = "admin.html";
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const role = snap.exists() ? snap.data().role || "participant" : "participant";

  if (role === "admin") {
    window.location.href = "admin.html";
  }
});

redirectIfLoggedIn();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showToast("Please enter admin email and password.", "error");
    return;
  }

  if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
    localStorage.setItem("cfs_demo_admin", "active");
    showToast("Demo admin login successful.", "success");
    window.location.href = "admin.html";
    return;
  }

  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Logging in...";

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, "users", credential.user.uid);
    const snapshot = await getDoc(userRef);
    const role = snapshot.exists() ? snapshot.data().role || "participant" : "participant";

    if (role !== "admin") {
      await signOut(auth);
      showToast("This account does not have admin access.", "error");
      return;
    }

    showToast("Admin login successful.", "success");
    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    showToast(error.message || "Admin login failed.", "error");
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-label").textContent = "Login";
  }
});
