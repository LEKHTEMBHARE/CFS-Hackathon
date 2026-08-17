import { storage } from "./firebase-config.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const MAX_PRESENTATION_SIZE = 20 * 1024 * 1024;

export function isValidPresentationFile(file) {
  if (!file) return false;
  const lowerName = file.name.toLowerCase();
  const extensionOk = /\.(pdf|ppt|pptx)$/i.test(lowerName);
  const mimeOk = /application\/pdf|powerpoint|presentation/i.test(file.type || "");
  const sizeOk = file.size <= MAX_PRESENTATION_SIZE;
  return extensionOk && mimeOk && sizeOk;
}

export function uploadPresentationFile(uid, file, onProgress, onSuccess, onError) {
  if (!uid || !file) {
    onError?.(new Error("Missing file or user context."));
    return null;
  }

  if (!isValidPresentationFile(file)) {
    onError?.(new Error("Only PDF, PPT, or PPTX files up to 20 MB are allowed."));
    return null;
  }

  const safeName = encodeURIComponent(file.name.replace(/\s+/g, "_"));
  const storagePath = `hackathon-submissions/${uid}/presentation/${safeName}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on(
    "state_changed",
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress?.(Math.round(progress));
    },
    (error) => {
      onError?.(error);
    },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      onSuccess?.({
        fileName: file.name,
        downloadURL: url,
        storagePath,
        fileSize: file.size,
      });
    }
  );

  return uploadTask;
}

export async function deletePresentationFile(storagePath) {
  if (!storagePath) return;
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);
}
