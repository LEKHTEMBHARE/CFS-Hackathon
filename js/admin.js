import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderSubmissionCard, renderEmptyState } from "../components/ui.js";
import { requireAdmin } from "./auth-guard.js";

const submissionList = document.getElementById("submissionList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const statParticipants = document.getElementById("statParticipants");
const statTeams = document.getElementById("statTeams");
const statSubmitted = document.getElementById("statSubmitted");
const statPending = document.getElementById("statPending");

const state = {
  submissions: [],
  users: [],
};

function compareStrings(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function getFilteredAndSortedSubmissions() {
  let filterList = [...state.submissions];
  const queryText = searchInput.value.trim().toLowerCase();

  if (statusFilter.value !== "all") {
    filterList = filterList.filter((item) => item.status === statusFilter.value);
  }

  if (queryText) {
    filterList = filterList.filter((item) => {
      const teamName = (item.teamName || "").toLowerCase();
      const registrationNo = (item.registrationNo || "").toLowerCase();
      const leader = (item.teamLeader?.name || "").toLowerCase();
      return [teamName, registrationNo, leader].some((entry) => entry.includes(queryText));
    });
  }

  switch (sortSelect.value) {
    case "oldest":
      filterList.sort((a, b) => new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) - new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0));
      break;
    case "teamName":
      filterList.sort((a, b) => compareStrings(a.teamName, b.teamName));
      break;
    case "registrationNo":
      filterList.sort((a, b) => compareStrings(a.registrationNo, b.registrationNo));
      break;
    case "latest":
    default:
      filterList.sort((a, b) => {
        const aTime = a.submittedAt?.seconds ? a.submittedAt.seconds : a.createdAt?.seconds || 0;
        const bTime = b.submittedAt?.seconds ? b.submittedAt.seconds : b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      break;
  }

  return filterList;
}

function renderStats() {
  const totalTeams = state.submissions.length;
  const submitted = state.submissions.filter((item) => item.status === "submitted").length;
  const pending = totalTeams - submitted;

  statParticipants.textContent = String(state.users.length || 0);
  statTeams.textContent = String(totalTeams);
  statSubmitted.textContent = String(submitted);
  statPending.textContent = String(pending);
}

function renderList() {
  const filtered = getFilteredAndSortedSubmissions();

  if (!filtered.length) {
    submissionList.innerHTML = renderEmptyState("No submissions match the current filters.");
    return;
  }

  submissionList.innerHTML = filtered.map((submission) => renderSubmissionCard(submission)).join("");
}

async function loadAdminData() {
  const isDemoAdmin = localStorage.getItem("cfs_demo_admin") === "active";

  if (!isDemoAdmin) {
    const user = auth.currentUser;
    if (!user) {
      window.location.href = "admin-login.html";
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const role = userSnap.exists() ? userSnap.data().role || "participant" : "participant";

    if (role !== "admin") {
      await signOut(auth);
      window.location.href = "admin-login.html";
      return;
    }
  }

  const usersQuery = query(collection(db, "users"));
  const usersSnap = await getDocs(usersQuery);
  state.users = usersSnap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));

  const submissionsQuery = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
  const submissionsSnap = await getDocs(submissionsQuery);
  state.submissions = submissionsSnap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));

  renderStats();
  renderList();
}

searchInput.addEventListener("input", renderList);
statusFilter.addEventListener("change", renderList);
sortSelect.addEventListener("change", renderList);

submissionList.addEventListener("click", (event) => {
  const card = event.target.closest(".submission-card--clickable");
  const button = event.target.closest(".view-submission-btn");
  const uid = (card || button)?.dataset.uid;

  if (!uid) return;
  window.location.href = `admin-submission.html?uid=${uid}`;
});

submissionList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest(".submission-card--clickable");
  if (!card) return;

  event.preventDefault();
  const uid = card.dataset.uid;
  if (uid) {
    window.location.href = `admin-submission.html?uid=${uid}`;
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  localStorage.removeItem("cfs_demo_admin");
  await signOut(auth);
  window.location.href = "admin-login.html";
});

requireAdmin((user) => {
  loadAdminData();
}, "admin-login.html");
