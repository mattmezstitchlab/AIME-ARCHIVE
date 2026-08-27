// Représentation temporelle robuste : une journée d'événement commence à DAY_ANCHOR
// et se poursuit après minuit. 22:00 -> 02:00 est donc une durée de 240 minutes,
// et 02:00 est postérieur à 22:00 dans l'ordre du monde.
export const DAY_ANCHOR = 6 * 60; // 06:00

export function parseTime(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function formatTime(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Point absolu sur l'axe du monde (gère le passage de minuit).
export function toWorldMinutes(hhmm) {
  const t = parseTime(hhmm);
  if (t === null) return null;
  return t < DAY_ANCHOR ? t + 1440 : t;
}

export function addMinutes(hhmm, delta) {
  const t = parseTime(hhmm);
  return t === null ? hhmm : formatTime(t + delta);
}

// Intervalle absolu d'un TimeBlock. end < start signifie franchissement de minuit.
export function blockInterval(block) {
  const start = toWorldMinutes(block.start_time);
  if (start === null) return null;
  let end = block.end_time ? toWorldMinutes(block.end_time) : start;
  if (end < start) end += 1440;
  return { start, end, duration: end - start, buffer: Number(block.buffer_minutes) || 0 };
}

export function durationOf(block) {
  const i = blockInterval(block);
  return i ? i.duration : null;
}

export function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Déplace un bloc de `delta` minutes en conservant sa durée réelle.
export function shiftBlock(block, delta) {
  const i = blockInterval(block);
  return {
    start_time: addMinutes(block.start_time, delta),
    end_time: block.end_time ? formatTime(((i.start + delta) % 1440) + i.duration) : block.end_time,
  };
}

export function setBlockStart(block, newStart) {
  const i = blockInterval(block);
  const target = toWorldMinutes(newStart);
  if (i === null || target === null) return null;
  return { start_time: newStart, end_time: block.end_time ? formatTime(target + i.duration) : block.end_time };
}