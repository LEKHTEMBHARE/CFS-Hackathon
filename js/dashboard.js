import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getSubmission, saveSubmission } from "./firestore.js";
import { showToast, formatDate, validateUrl } from "../components/ui.js";
import { requireAuth } from "./auth-guard.js";

const form = document.getElementById("submissionForm");
const teamMembersContainer = document.getElementById("teamMembersContainer");
const addMemberBtn = document.getElementById("addMemberBtn");
const presentationUrlInput = document.getElementById("presentationUrl");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const submitBtn = document.getElementById("submitBtn");
const reviewSummary = document.getElementById("reviewSummary");
const stepNav = document.getElementById("stepNav");
const loadingState = document.getElementById("loadingState");
const submitStatusPill = document.getElementById("submitStatusPill");
const confirmModal = document.getElementById("confirmModal");
const cancelSubmitBtn = document.getElementById("cancelSubmitBtn");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");
const logoutBtn = document.getElementById("logoutBtn");

const totalSteps = 4;
const state = {
  currentStep: 1,
  extraMembers: [],
  currentUser: null,
  submission: null,
  isLocked: false,
};

function teamMemberNameForIndex(index) {
  return `member${index}`;
}

function ensureSubmissionRecord(uid) {
  return setDoc(doc(db, "submissions", uid), {
    uid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

function setStep(step) {
  state.currentStep = step;
  const sections = [...document.querySelectorAll(".form-step")];
  sections.forEach((section) => {
    const isActive = Number(section.dataset.step) === step;
    section.classList.toggle("active", isActive);
  });

  const navItems = [...document.querySelectorAll(".step-nav-item")];
  navItems.forEach((item) => {
    const isActive = Number(item.dataset.step) === step;
    item.classList.toggle("active", isActive);
  });

  prevBtn.classList.toggle("hidden", step === 1);
  nextBtn.classList.toggle("hidden", step === totalSteps);
  submitBtn.classList.toggle("hidden", step !== totalSteps || state.isLocked);
  updateLeaderNameField();

  if (step === totalSteps) {
    renderReviewSummary();
  }
}

function parseMobileNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function renderStepNav() {
  stepNav.innerHTML = [1, 2, 3, 4]
    .map((num) => `
      <button type="button" class="step-nav-item ${num === 1 ? "active" : ""}" data-step="${num}">
        <span class="badge">${num}</span>
        <span>${["Team Members", "Team Details", "Project Details", "Review"][num - 1]}</span>
      </button>
    `)
    .join("");

  stepNav.querySelectorAll(".step-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (state.isLocked) return;
      setStep(Number(item.dataset.step));
    });
  });
}

function renderTeamMembers() {
  const leader = state.submission?.teamLeader || { name: "", email: "", mobile: "" };
  const members = state.submission?.members || {};

  const otherMembers = Array.from({ length: 3 }, (_, index) => {
    const memberKey = teamMemberNameForIndex(index + 2);
    return {
      key: memberKey,
      name: members[memberKey] || "",
    };
  });

  while (state.extraMembers.length > otherMembers.length) {
    state.extraMembers.pop();
  }

  while (state.extraMembers.length < otherMembers.length) {
    state.extraMembers.push({ key: `member${state.extraMembers.length + 2}`, name: "" });
  }

  const rows = state.extraMembers
    .map((member, index) => {
      const key = member.key || teamMemberNameForIndex(index + 2);
      const name = member.name || members[key] || "";
      return `
        <div class="member-card">
          <div class="member-header">
            <h4>Member ${index + 2}</h4>
            ${state.extraMembers.length > 1 ? `<button type="button" class="btn btn-ghost danger remove-member-btn" data-member-key="${key}">Remove</button>` : ""}
          </div>
          <div class="field-group">
            <label for="${key}">Name</label>
            <input id="${key}" data-member-key="${key}" type="text" value="${escapeHtml(name)}" placeholder="Enter member name" />
          </div>
        </div>
      `;
    })
    .join("");

  teamMembersContainer.innerHTML = `
    <div class="member-card">
      <div class="member-header">
        <h4>Team Leader</h4>
      </div>
      <div class="field-group">
        <label for="leaderName">Name</label>
        <input id="leaderName" type="text" value="${escapeHtml(leader.name || "")}" placeholder="Enter team leader name" />
      </div>
      <div class="field-group">
        <label for="leaderEmail">Email</label>
        <input id="leaderEmail" type="email" value="${escapeHtml(leader.email || "")}" placeholder="leader@example.com" />
      </div>
      <div class="field-group">
        <label for="leaderMobile">Mobile Number</label>
        <input id="leaderMobile" type="tel" value="${escapeHtml(leader.mobile || "")}" placeholder="10-digit mobile number" />
      </div>
    </div>
    <div class="member-list">${rows}</div>
  `;

  attachMemberHandlers();
  updateLeaderNameField();
}

function attachMemberHandlers() {
  document.getElementById("leaderName")?.addEventListener("input", (event) => {
    if (state.isLocked) return;
    const value = event.target.value.trim();
    state.submission = state.submission || {};
    state.submission.teamLeader = state.submission.teamLeader || {};
    state.submission.teamLeader.name = value;
    updateLeaderNameField();
  });

  document.getElementById("leaderEmail")?.addEventListener("input", (event) => {
    if (state.isLocked) return;
    const value = event.target.value.trim();
    state.submission = state.submission || {};
    state.submission.teamLeader = state.submission.teamLeader || {};
    state.submission.teamLeader.email = value;
  });

  document.getElementById("leaderMobile")?.addEventListener("input", (event) => {
    if (state.isLocked) return;
    const value = parseMobileNumber(event.target.value);
    event.target.value = value;
    state.submission = state.submission || {};
    state.submission.teamLeader = state.submission.teamLeader || {};
    state.submission.teamLeader.mobile = value;
  });

  teamMembersContainer.querySelectorAll("[data-member-key]").forEach((input) => {
    input.addEventListener("input", (event) => {
      if (state.isLocked) return;
      const memberKey = event.target.dataset.memberKey;
      const name = event.target.value.trim();
      state.submission = state.submission || {};
      state.submission.members = state.submission.members || {};
      if (name) {
        state.submission.members[memberKey] = name;
      } else {
        delete state.submission.members[memberKey];
      }
    });
  });

  teamMembersContainer.querySelectorAll(".remove-member-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.isLocked) return;
      const key = button.dataset.memberKey;
      state.extraMembers = state.extraMembers.filter((member) => member.key !== key);
      renderTeamMembers();
    });
  });
}

function updateLeaderNameField() {
  const leaderName = document.getElementById("leaderName");
  const leaderField = document.getElementById("leaderNameReadOnly");
  const value = leaderName?.value?.trim() || state.submission?.teamLeader?.name || "";
  if (leaderField) leaderField.value = value;
}

function addMember() {
  if (state.isLocked) return;
  if (state.extraMembers.length >= 3) {
    showToast("You can add up to 3 additional members.", "error");
    return;
  }

  const nextIndex = state.extraMembers.length + 2;
  state.extraMembers.push({ key: `member${nextIndex}`, name: "" });
  renderTeamMembers();
}

function saveDraft(triggerMessage = false) {
  if (!state.currentUser || state.isLocked) return;

  if (!state.submission) {
    state.submission = {};
  }

  const registrationNo = document.getElementById("registrationNo")?.value?.trim() || "";
  const teamName = document.getElementById("teamName")?.value?.trim() || "";
  const githubUrl = document.getElementById("githubUrl")?.value?.trim() || "";
  const presentationUrl = document.getElementById("presentationUrl")?.value?.trim() || "";
  const videoUrl = document.getElementById("videoUrl")?.value?.trim() || "";

  state.submission.registrationNo = registrationNo;
  state.submission.teamName = teamName;
  state.submission.githubUrl = githubUrl;
  state.submission.presentationUrl = presentationUrl;
  state.submission.videoUrl = videoUrl;
  state.submission.status = "pending";

  saveSubmission(state.currentUser.uid, state.submission)
    .then(() => {
      if (triggerMessage) showToast("Draft saved.", "success");
    })
    .catch((error) => {
      console.error(error);
      if (triggerMessage) showToast("Unable to save your draft.", "error");
    });
}

function renderReviewSummary() {
  const leader = state.submission?.teamLeader || {};
  const members = state.submission?.members || {};
  const registrationNo = state.submission?.registrationNo || "";
  const teamName = state.submission?.teamName || "";
  const githubUrl = state.submission?.githubUrl || "";
  const presentationUrl = state.submission?.presentationUrl || "";
  const videoUrl = state.submission?.videoUrl || "";

  const groups = [
    {
      label: "Team members added",
      detail: leader.name ? `${leader.name} + ${Object.values(members).filter(Boolean).length} extra members` : "Not completed",
      ok: Boolean(leader.name),
    },
    {
      label: "Team / registration details",
      detail: registrationNo && teamName ? `${teamName} • ${registrationNo}` : "Not completed",
      ok: Boolean(registrationNo && teamName),
    },
    {
      label: "GitHub repository",
      detail: githubUrl || "Not added",
      ok: Boolean(githubUrl && validateUrl(githubUrl)),
    },
    {
      label: "Presentation link",
      detail: presentationUrl || "Not added",
      ok: Boolean(presentationUrl && validateUrl(presentationUrl)),
    },
    {
      label: "Demo video link",
      detail: videoUrl || "Not added",
      ok: Boolean(videoUrl && validateUrl(videoUrl)),
    },
  ];

  reviewSummary.innerHTML = groups
    .map(
      (item) => `
        <div class="review-item">
          <div>
            <strong>${item.label}</strong>
            <p>${item.detail}</p>
          </div>
          <span class="check">${item.ok ? "✓" : "!"}</span>
        </div>
      `
    )
    .join("");
}

function validateCurrentStep() {
  if (state.currentStep === 1) {
    const leaderName = document.getElementById("leaderName")?.value?.trim();
    const leaderEmail = document.getElementById("leaderEmail")?.value?.trim();
    const leaderMobile = document.getElementById("leaderMobile")?.value?.trim();

    if (!leaderName) {
      showToast("Team leader name is required.", "error");
      return false;
    }

    if (!/^\S+@\S+\.\S+$/.test(leaderEmail)) {
      showToast("Please enter a valid team leader email.", "error");
      return false;
    }

    if (!/^\d{10}$/.test(leaderMobile)) {
      showToast("Team leader mobile must be exactly 10 digits.", "error");
      return false;
    }

    const otherMembers = [...teamMembersContainer.querySelectorAll("[data-member-key]")].filter((input) => input.id !== "leaderName" && input.id !== "leaderEmail" && input.id !== "leaderMobile");
    for (const member of otherMembers) {
      if (member.value.trim() && member.value.trim().length < 2) {
        showToast("Additional member names must be at least 2 characters long.", "error");
        return false;
      }
    }

    return true;
  }

  if (state.currentStep === 2) {
    const registrationNo = document.getElementById("registrationNo")?.value?.trim();
    const teamName = document.getElementById("teamName")?.value?.trim();

    if (!registrationNo) {
      showToast("Team / registration number is required.", "error");
      return false;
    }

    if (!teamName) {
      showToast("Team name is required.", "error");
      return false;
    }

    return true;
  }

  if (state.currentStep === 3) {
    const githubUrl = document.getElementById("githubUrl")?.value?.trim();
    const presentationUrl = document.getElementById("presentationUrl")?.value?.trim();
    const videoUrl = document.getElementById("videoUrl")?.value?.trim();

    if (!githubUrl || !validateUrl(githubUrl)) {
      showToast("Please provide a valid GitHub repository URL.", "error");
      return false;
    }

    if (!presentationUrl || !validateUrl(presentationUrl)) {
      showToast("Please provide a valid presentation URL.", "error");
      return false;
    }

    if (!videoUrl || !validateUrl(videoUrl)) {
      showToast("Please provide a valid demo video URL.", "error");
      return false;
    }

    return true;
  }

  return true;
}

async function loadExistingDraft() {
  if (!state.currentUser) return;

  const submission = await getSubmission(state.currentUser.uid);
  state.submission = submission || {};

  if (submission?.status === "submitted") {
    state.isLocked = true;
    submitStatusPill.textContent = "Submitted ✓";
    submitStatusPill.className = "status-pill status-submitted";
    form.querySelectorAll("input, button").forEach((element) => {
      if (element.id !== "logoutBtn" && !element.classList.contains("view-submission-btn")) {
        if (element.tagName === "BUTTON") {
          element.disabled = true;
        } else {
          element.setAttribute("readonly", "readonly");
          element.disabled = true;
        }
      }
    });
    renderSubmissionLockedState();
    return;
  }

  submitStatusPill.textContent = "Draft";
  submitStatusPill.className = "status-pill status-pending";

  if (submission?.teamLeader) {
    state.submission = state.submission || {};
    state.submission.teamLeader = {
      ...(state.submission.teamLeader || {}),
      ...submission.teamLeader,
    };
  }

  if (submission?.members) {
    const existingMembers = Object.entries(submission.members).filter(([, value]) => value);
    state.extraMembers = existingMembers.map(([key, name]) => ({ key, name })) || [];
    if (state.extraMembers.length < 3) {
      state.extraMembers.push({ key: `member${state.extraMembers.length + 2}`, name: "" });
    }
  } else {
    state.extraMembers = [{ key: "member2", name: "" }];
  }

  renderTeamMembers();

  const leaderNameInput = document.getElementById("leaderName");
  const leaderEmailInput = document.getElementById("leaderEmail");
  const leaderMobileInput = document.getElementById("leaderMobile");
  const registrationInput = document.getElementById("registrationNo");
  const teamNameInput = document.getElementById("teamName");
  const githubInput = document.getElementById("githubUrl");
  const presentationInput = document.getElementById("presentationUrl");
  const videoInput = document.getElementById("videoUrl");

  if (leaderNameInput) leaderNameInput.value = submission?.teamLeader?.name || "";
  if (leaderEmailInput) leaderEmailInput.value = submission?.teamLeader?.email || "";
  if (leaderMobileInput) leaderMobileInput.value = submission?.teamLeader?.mobile || "";
  if (registrationInput) registrationInput.value = submission?.registrationNo || "";
  if (teamNameInput) teamNameInput.value = submission?.teamName || "";
  if (githubInput) githubInput.value = submission?.githubUrl || "";
  if (presentationInput) presentationInput.value = submission?.presentationUrl || "";
  if (videoInput) videoInput.value = submission?.videoUrl || "";
}

function renderSubmissionLockedState() {
  const lockedSection = document.createElement("div");
  lockedSection.className = "submission-locked";
  lockedSection.innerHTML = `
    <h3>Submission Already Completed</h3>
    <p>Your project has already been submitted and is locked for review.</p>
    <div class="meta">
      <span>Submitted On: ${formatDate(state.submission?.submittedAt)}</span>
      <span>Status: Submitted ✓</span>
    </div>
  `;
  form.prepend(lockedSection);
}

async function finalizeSubmission() {
  if (!state.currentUser) return;

  const submission = await getSubmission(state.currentUser.uid);
  if (submission?.status === "submitted") {
    showToast("Submission Already Completed.", "error");
    return;
  }

  saveDraft();
  await saveSubmission(state.currentUser.uid, {
    ...state.submission,
    status: "submitted",
  });

  state.isLocked = true;
  submitStatusPill.textContent = "Submitted ✓";
  submitStatusPill.className = "status-pill status-submitted";
  confirmModal.classList.add("hidden");
  showToast("Project submitted successfully.", "success");
  form.querySelectorAll("input, button").forEach((element) => {
    if (element.id !== "logoutBtn") {
      if (element.tagName === "BUTTON") {
        element.disabled = true;
      } else {
        element.setAttribute("readonly", "readonly");
        element.disabled = true;
      }
    }
  });
  nextBtn.classList.add("hidden");
  prevBtn.classList.add("hidden");
  submitBtn.classList.add("hidden");
  renderReviewSummary();
}

function attachFormEvents() {
  addMemberBtn.addEventListener("click", addMember);

  nextBtn.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    saveDraft();
    setStep(Math.min(state.currentStep + 1, totalSteps));
  });

  prevBtn.addEventListener("click", () => {
    setStep(Math.max(1, state.currentStep - 1));
  });

  submitBtn.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    saveDraft();
    confirmModal.classList.remove("hidden");
  });

  cancelSubmitBtn.addEventListener("click", () => {
    confirmModal.classList.add("hidden");
  });

  confirmSubmitBtn.addEventListener("click", finalizeSubmission);

  document.getElementById("registrationNo")?.addEventListener("input", () => saveDraft());
  document.getElementById("teamName")?.addEventListener("input", () => saveDraft());
  document.getElementById("githubUrl")?.addEventListener("input", () => saveDraft());
  document.getElementById("presentationUrl")?.addEventListener("input", () => saveDraft());
  document.getElementById("videoUrl")?.addEventListener("input", () => saveDraft());

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function initializeDashboard() {
  loadingState.classList.remove("hidden");

  requireAuth(async (user) => {
    state.currentUser = user;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const role = userDoc.exists() ? userDoc.data().role || "participant" : "participant";
      if (role === "admin") {
        window.location.href = "admin.html";
        return;
      }

      await ensureSubmissionRecord(user.uid);
      await loadExistingDraft();
      renderStepNav();
      setStep(1);
      renderReviewSummary();
      attachFormEvents();
    } catch (error) {
      console.error(error);
      showToast("Could not load your dashboard.", "error");
    } finally {
      loadingState.classList.add("hidden");
    }
  }, "login.html");
}

initializeDashboard();
