function sanitizeGuestName(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40) || "guest";
}

export function buildGuestIdPhotoFileName(guestName: string, extension = "jpg"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `ID_${sanitizeGuestName(guestName)}_${stamp}.${extension}`;
}

export async function saveGuestIdPhotoToLocalDisk(
  file: File,
  guestName: string,
): Promise<string> {
  const suggestedName = buildGuestIdPhotoFileName(
    guestName,
    file.name.split(".").pop()?.toLowerCase() || "jpg",
  );

  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const picker = window as Window &
        typeof globalThis & {
          showSaveFilePicker: (options: {
            suggestedName: string;
            types: { description: string; accept: Record<string, string[]> }[];
          }) => Promise<FileSystemFileHandle>;
        };

      const handle = await picker.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "ID photo",
            accept: {
              "image/jpeg": [".jpg", ".jpeg"],
              "image/png": [".png"],
              "image/webp": [".webp"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return handle.name;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("ID photo save cancelled");
      }
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return suggestedName;
}
