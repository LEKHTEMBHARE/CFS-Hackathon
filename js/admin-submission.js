import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderStatusBadge, formatDate } from "../components/ui.js";
import { requireAdmin } from "./auth-guard.js";

const detailContent = document.getElementById("detailContent");
const detailStatus = document.getElementById("detailStatus");
const logoutBtn = document.getElementById("adminLogoutBtn");

function getUidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("uid");
}

function renderInfoCard(title, rows) {
  return `
    <div class="detail-card">
      <div class="detail-header">
        <h3>${title}</h3>
      </div>
      <div class="info-list">
        ${rows
          .map(
            ([label, value]) => `
              <div class="info-item">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function findNestedValue(target, keyPath) {
  return keyPath.split(".").reduce((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    const exact = acc[part];
    if (exact !== undefined) return exact;
    const matches = Object.keys(acc).find((candidate) => candidate.toLowerCase() === part.toLowerCase());
    return matches ? acc[matches] : undefined;
  }, target);
}

function readSubmissionLink(data, keys) {
  if (!data || typeof data !== "object") return "";

  for (const key of keys) {
    const value = findNestedValue(data, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "object" && value && typeof value.url === "string" && value.url.trim()) return value.url.trim();
    if (typeof value === "object" && value && typeof value.downloadURL === "string" && value.downloadURL.trim()) return value.downloadURL.trim();
  }

  const allValues = Object.values(data || {});
  for (const entry of allValues) {
    if (typeof entry === "string" && /^(https?:|mailto:)/i.test(entry.trim())) return entry.trim();
    if (entry && typeof entry === "object") {
      const nested = readSubmissionLink(entry, ["url", "downloadURL", "href", "link", "github", "presentation", "video"]);
      if (nested) return nested;
    }
  }

  return "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidSubmittedUrl(value) {
  const candidate = getLinkHref(value);
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getLinkHref(value) {
  const trimmed = String(value || "").trim();
  return /^(?:https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function renderLinkCell(value, label) {
  if (typeof value !== "string" || !value.trim()) return "Not provided";
  const submittedUrl = value.trim().replace(/[),.;!?]+$/g, "");
  if (!isValidSubmittedUrl(submittedUrl)) return escapeHtml(value);

  const href = getLinkHref(submittedUrl);
  return `
    <span class="link-stack">
      <a class="detail-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(submittedUrl)}">Open ${label}</a>
      <small class="detail-link-url">${escapeHtml(submittedUrl)}</small>
    </span>
  `;
}

function renderMembersList(data) {
  const members = Object.entries(data?.members || {}).filter(([, value]) => value && String(value).trim());
  if (!members.length) return "No additional members added.";
  return `<ul>${members.map(([, value]) => `<li>${value}</li>`).join("")}</ul>`;
}

async function loadSubmissionDetail() {
  const uid = getUidFromUrl();
  if (!uid) {
    detailContent.innerHTML = '<div class="empty-state">No team selected.</div>';
    return;
  }

  const submissionRef = doc(db, "submissions", uid);
  const submissionSnap = await getDoc(submissionRef);
  if (!submissionSnap.exists()) {
    detailContent.innerHTML = '<div class="empty-state">This submission could not be found.</div>';
    return;
  }

  const data = submissionSnap.data();
  detailStatus.innerHTML = renderStatusBadge(data.status || "pending");

  const leader = data.teamLeader || {};
  const githubSource = readSubmissionLink(data, ["githubUrl", "githubURL", "github", "githubLink", "projectLinks.github", "repositoryUrl", "projectLinks.githubURL"]);
  const presentationSource = readSubmissionLink(data, ["presentationUrl", "presentationURL", "presentationLink", "presentation", "projectLinks.presentation", "ppt.downloadURL", "presentation.downloadURL", "ppt.url", "projectLinks.presentationURL"]);
  const videoSource = readSubmissionLink(data, ["videoUrl", "videoURL", "videoLink", "demoUrl", "projectLinks.video", "demoVideoUrl", "projectLinks.videoURL"]);

  const githubUrl = renderLinkCell(githubSource, "GitHub");
  const presentationUrl = renderLinkCell(presentationSource, "Presentation");
  const videoUrl = renderLinkCell(videoSource, "Video");

  detailContent.innerHTML = `
    <div class="detail-card">
      <div class="detail-header">
        <h3>Team Overview</h3>
      </div>
      <div class="info-list">
        <div class="info-item"><span>Team Name</span><strong>${data.teamName || "N/A"}</strong></div>
        <div class="info-item"><span>Registration No.</span><strong>${data.registrationNo || "N/A"}</strong></div>
        <div class="info-item"><span>Status</span><strong>${data.status || "pending"}</strong></div>
        <div class="info-item"><span>Submitted At</span><strong>${formatDate(data.submittedAt || data.updatedAt || data.createdAt)}</strong></div>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-header">
        <h3>Project Links</h3>
      </div>
      <div class="info-list">
        <div class="info-item"><span>GitHub</span><strong>${githubUrl}</strong></div>
        <div class="info-item"><span>Presentation</span><strong>${presentationUrl}</strong></div>
        <div class="info-item"><span>Video</span><strong>${videoUrl}</strong></div>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-header">
        <h3>Team Leader</h3>
      </div>
      <div class="info-list">
        <div class="info-item"><span>Name</span><strong>${leader.name || "N/A"}</strong></div>
        <div class="info-item"><span>Email</span><strong>${leader.email || "N/A"}</strong></div>
        <div class="info-item"><span>Mobile</span><strong>${leader.mobile || "N/A"}</strong></div>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-header">
        <h3>Other Members</h3>
      </div>
      <div class="info-list">
        <div class="info-item"><span>Members</span><strong>${renderMembersList(data)}</strong></div>
      </div>
    </div>
  `;
}

requireAdmin(async () => {
  loadSubmissionDetail();
}, "admin-login.html");

logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem("cfs_demo_admin");
  await signOut(auth);
  window.location.href = "admin-login.html";
});
