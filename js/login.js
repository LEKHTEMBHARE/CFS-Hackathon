import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { observeAuthState, logoutUser } from "./auth.js";
import { saveUserProfile } from "./firestore.js";
import { showToast } from "../components/ui.js";

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

observeAuthState(async ({ user, role }) => {
  if (!user) return;

  if (role === "admin") {
    await logoutUser();
    showToast("Admin accounts must use the admin portal.", "error");
    return;
  }

  window.location.href = "dashboard.html";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showToast("Please enter both email and password.", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.querySelector(".btn-label").textContent = "Logging in...";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userSnap = await getDoc(userDocRef);
    const role = userSnap.exists() ? userSnap.data().role || "participant" : "participant";

    if (role === "admin") {
      await logoutUser();
      showToast("This account is not authorized for participant access.", "error");
      return;
    }

    await saveUserProfile(userCredential.user.uid, {
      role: "participant",
      email: userCredential.user.email,
    });

    showToast("Login successful.", "success");
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    showToast(error.message || "Login failed. Please check your credentials.", "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.querySelector(".btn-label").textContent = "Login";
  }
});
