const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function formatPHP(amount: number): string {
  return PHP.format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
