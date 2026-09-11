import type { Upload, UploadSource } from "@upflowi/core";
import { createUploader } from "@upflowi/core";
import { createHttpProvider } from "@upflowi/provider-http";
import { createFetchTransport } from "@upflowi/transport-fetch";
import "./style.css";

const SERVER_URL = "http://localhost:3001";

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Missing element for selector "${selector}".`);
  }
  return element;
}

const fileInput = requireElement<HTMLInputElement>("#file-input");
const startButton = requireElement<HTMLButtonElement>("#start-button");
const pauseButton = requireElement<HTMLButtonElement>("#pause-button");
const resumeButton = requireElement<HTMLButtonElement>("#resume-button");
const cancelButton = requireElement<HTMLButtonElement>("#cancel-button");
const progressBar = requireElement<HTMLProgressElement>("#progress-bar");
const progressLabel = requireElement<HTMLSpanElement>("#progress-label");
const eventLog = requireElement<HTMLPreElement>("#event-log");

let currentUpload: Upload | undefined;

function appendLog(message: string): void {
  eventLog.textContent = `${eventLog.textContent ?? ""}${message}\n`;
  eventLog.scrollTop = eventLog.scrollHeight;
}

function setControlsForActiveUpload(active: boolean): void {
  startButton.disabled = active;
  pauseButton.disabled = !active;
  resumeButton.disabled = !active;
  cancelButton.disabled = !active;
}

function createFileSource(file: File): UploadSource {
  return {
    fileId: file.name,
    read: async ({ start, end }) => file.slice(start, end),
    size: file.size,
  };
}

function startUpload(file: File): void {
  progressBar.value = 0;
  progressLabel.textContent = "0%";
  eventLog.textContent = "";

  const uploader = createUploader({
    chunkConcurrency: 3,
    chunkSize: 5 * 1024 * 1024,
    provider: createHttpProvider({
      baseUrl: SERVER_URL,
    }),
    transport: createFetchTransport(),
  });

  const upload = uploader.add({
    source: createFileSource(file),
  });
  currentUpload = upload;
  setControlsForActiveUpload(true);

  upload.on("started", () => appendLog(`started: ${file.name}`));
  upload.on("progress", (progress) => {
    progressBar.value = progress.percent;
    progressLabel.textContent = `${progress.percent.toFixed(1)}%`;
  });
  upload.on("retry", ({ attempt, error }) =>
    appendLog(`retry #${attempt}: ${error.message}`),
  );
  upload.on("paused", () => appendLog("paused"));
  upload.on("resumed", () => appendLog("resumed"));
  upload.on("completed", ({ result }) => {
    appendLog(`completed: ${JSON.stringify(result)}`);
    setControlsForActiveUpload(false);
  });
  upload.on("failed", ({ error }) => {
    appendLog(`failed: ${error.message}`);
    setControlsForActiveUpload(false);
  });
  upload.on("cancelled", () => {
    appendLog("cancelled");
    setControlsForActiveUpload(false);
  });

  uploader.start();
}

startButton.addEventListener("click", () => {
  const file = fileInput.files?.[0];
  if (file === undefined) {
    appendLog("Pick a file first.");
    return;
  }
  startUpload(file);
});

pauseButton.addEventListener("click", () => currentUpload?.pause());
resumeButton.addEventListener("click", () => currentUpload?.resume());
cancelButton.addEventListener("click", () => currentUpload?.cancel());
