/** Full page redirect so the session cookie and client state are fully cleared. */
export async function signOut(options?: { reason?: "idle" | "manual" }): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
  } finally {
    const params = new URLSearchParams({ signedOut: "1" });
    if (options?.reason === "idle") {
      params.set("reason", "idle");
    }
    window.location.replace(`/login?${params.toString()}`);
  }
}
