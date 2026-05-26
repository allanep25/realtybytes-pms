"use client";

import { saveGuestIdPhotoToLocalDisk } from "@/lib/guest-id-photo";
import { cn } from "@/lib/utils";
import { Camera, ImageUp, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type GuestIdCaptureProps = {
  guestName: string;
  savedFileName: string | null;
  onSaved: (fileName: string) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function GuestIdCapture({
  guestName,
  savedFileName,
  onSaved,
  onClear,
  disabled = false,
}: GuestIdCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function persistPhoto(file: File) {
    if (!guestName.trim()) {
      throw new Error("Enter the guest name before saving an ID photo");
    }

    setSaving(true);
    setError(null);
    try {
      const fileName = await saveGuestIdPhotoToLocalDisk(file, guestName);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      onSaved(fileName);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    try {
      await persistPhoto(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ID photo");
    }
  }

  async function openCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Could not access the webcam. Allow camera permission or upload a file instead.");
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError("Failed to capture photo");
          return;
        }
        try {
          await persistPhoto(new File([blob], "id-photo.jpg", { type: "image/jpeg" }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save ID photo");
        }
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleClear() {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    onClear();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">ID photo (optional)</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload or capture with webcam. Saved to this computer only — not uploaded to the cloud.
          </p>
        </div>
        {savedFileName && (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-room-dirty"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {savedFileName && (
        <p className="mt-2 text-xs text-room-vacant">
          Saved locally as <span className="font-medium">{savedFileName}</span>
        </p>
      )}

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Captured ID preview"
          className="mt-3 max-h-40 rounded-lg border border-slate-200 object-contain"
        />
      )}

      {cameraOpen && (
        <div className="mt-3 space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black">
            <video ref={videoRef} className="max-h-56 w-full object-contain" playsInline muted />
            <button
              type="button"
              onClick={stopCamera}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Close camera"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void captureFromCamera()}
            className="rounded-lg bg-room-occupied px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Capture photo"}
          </button>
        </div>
      )}

      {!cameraOpen && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void openCamera()}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50",
            )}
          >
            <Camera className="h-4 w-4" />
            Use webcam
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            <ImageUp className="h-4 w-4" />
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleUploadChange(e)}
          />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-room-dirty">{error}</p>}
    </div>
  );
}
