/**
 * Smol Café — Day & Night Theme Manager (IST Timed Auto-Switch)
 * Automatically enables Dark Mode from 6:00 PM (18:00) to 4:00 AM (04:00) IST (Asia/Kolkata).
 * Supports manual user overrides and live periodic checks.
 */

export function isLocalNightTime(): boolean {
  try {
    const localHour = new Date().getHours();
    // 18:00 (6:00 PM) to 06:00 (6:00 AM) local time -> Dark mode
    return localHour >= 18 || localHour < 6;
  } catch {
    return false;
  }
}

export const isISTNightTime = isLocalNightTime; // for backwards compatibility

export function resolveEffectiveTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem("smol_theme");
    if (saved === "night" || saved === "dark") return true;
    if (saved === "day" || saved === "light") return false;
    return isISTNightTime();
  } catch {
    return isISTNightTime();
  }
}

export function applyThemeToDOM(dark: boolean): void {
  if (typeof document === "undefined") return;
  const targetColor = dark ? "#151110" : "#F3E7D3";
  if (dark) {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "night");
    document.body.style.backgroundColor = "#241F1C";
    document.body.style.color = "#F3E7D3";
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "day");
    document.body.style.backgroundColor = "#F3E7D3";
    document.body.style.color = "#241F1C";
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", targetColor);
  }
}
