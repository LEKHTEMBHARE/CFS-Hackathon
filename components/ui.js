export function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2600);
}

export function renderStatusBadge(status) {
  const normalized = String(status || "pending").toLowerCase();
  const label = normalized === "submitted" ? "Submitted" : "Pending";
  const className = normalized === "submitted" ? "status-submitted" : "status-pending";
  return `<span class="status-pill ${className}">${label}</span>`;
}

export function renderEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

export function renderMemberSummary(members = {}) {
  const names = Object.entries(members)
    .filter(([, value]) => value && String(value).trim())
    .map(([, value]) => value)
    .filter(Boolean);

  if (!names.length) return "No additional members added.";
  return names.map((name) => `<li>${name}</li>`).join("");
}

export function renderSubmissionCard(data) {
  const teamName = data.teamName || "Unnamed Team";
  const registrationNo = data.registrationNo || "N/A";
  const leader = data.teamLeader || {};
  const statusHtml = renderStatusBadge(data.status);
  const submittedAt = data.submittedAt?.seconds ? new Date(data.submittedAt.seconds * 1000) : data.submittedAt || data.updatedAt || data.createdAt;
  const dateText = submittedAt && submittedAt.seconds ? new Date(submittedAt.seconds * 1000).toLocaleString() : "Not submitted yet";

  const hasGitHub = Boolean(data.githubUrl);
  const hasPresentation = Boolean(data.presentationUrl || data.ppt?.downloadURL || data.ppt?.storagePath || data.presentation?.downloadURL);
  const hasVideo = Boolean(data.videoUrl);

  return `
    <article class="submission-card submission-card--clickable" data-uid="${data.uid}" tabindex="0" aria-label="View details for ${teamName}">
      <div class="submission-top">
        <div class="submission-top-left">
          <h3>${teamName}</h3>
          <div class="meta-row">
            <span>Reg. No: ${registrationNo}</span>
            <span>Leader: ${leader.name || "N/A"}</span>
          </div>
        </div>
        ${statusHtml}
      </div>

      <div class="submission-body">
        <div>
          <div class="meta-row">
            <span>Submitted: ${dateText}</span>
          </div>
        </div>
        <div class="submission-checklist">
          <span class="check-badge ${hasGitHub ? "" : "muted"}">${hasGitHub ? "✓" : "•"} GitHub</span>
          <span class="check-badge ${hasPresentation ? "" : "muted"}">${hasPresentation ? "✓" : "•"} Presentation</span>
          <span class="check-badge ${hasVideo ? "" : "muted"}">${hasVideo ? "✓" : "•"} Video</span>
        </div>
      </div>

      <div class="submission-footer">
        <div class="meta-row">
          <span>${data.status === "submitted" ? "Submission complete" : "Awaiting submission"}</span>
        </div>
        <button type="button" class="btn btn-primary view-submission-btn" data-uid="${data.uid}">View Submission</button>
      </div>
    </article>
  `;
}

export function formatDate(value) {
  if (!value) return "Not available";
  if (value.seconds) {
    return new Date(value.seconds * 1000).toLocaleString();
  }
  return new Date(value).toLocaleString();
}

export function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
