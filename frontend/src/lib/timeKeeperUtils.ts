/** Parse `HH:mm` (24h). */
export function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  return { h, m: min };
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function toHHMM(h24: number, minute: number) {
  return `${pad2(h24)}:${pad2(minute)}`;
}

/** 24h → 12h clock + AM/PM */
export function to12Hour(h24: number) {
  const isAM = h24 < 12;
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, isAM };
}

/** 12h clock + AM/PM → 24h hour */
export function from12Hour(h12: number, isAM: boolean, minute: number) {
  let h24: number;
  if (h12 === 12) {
    h24 = isAM ? 0 : 12;
  } else {
    h24 = isAM ? h12 : h12 + 12;
  }
  return toHHMM(h24, minute);
}

export function formatTimeDisplay(hhmm: string) {
  const p = parseHHMM(hhmm);
  if (!p) return hhmm;
  const d = new Date();
  d.setHours(p.h, p.m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function minuteOptions(step: number) {
  const out: number[] = [];
  for (let m = 0; m < 60; m += step) {
    out.push(m);
  }
  return out;
}
