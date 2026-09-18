const timeZone = process.env.NEXT_PUBLIC_OPERATIONS_TIME_ZONE || "Asia/Jakarta";

export function serviceDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + "-" + value.month + "-" + value.day;
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  if (whole < 60) return String(whole) + "s";
  return String(Math.floor(whole / 3600)) + "h " + String(Math.floor((whole % 3600) / 60)) + "m";
}
