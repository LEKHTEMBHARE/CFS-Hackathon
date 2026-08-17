import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwYntCt-hmvi2TRetA1FtUndoHVAEgEUQ",
  authDomain: "cfs-origin-2026.firebaseapp.com",
  projectId: "cfs-origin-2026",
  storageBucket: "cfs-origin-2026.firebasestorage.app",
  messagingSenderId: "215855082652",
  appId: "1:215855082652:web:89fd52e33c903a9d5ed159"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
