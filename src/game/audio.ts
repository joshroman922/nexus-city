let ctx: AudioContext | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

function beep(freq: number, dur: number, gain = 0.04, type: OscillatorType = "sine") {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export function sfxPlace() {
  beep(420, 0.12, 0.035, "triangle");
  setTimeout(() => beep(640, 0.1, 0.03, "triangle"), 70);
}

export function sfxWork() {
  beep(280, 0.08, 0.025, "sine");
}

export function sfxOpen() {
  beep(520, 0.07, 0.025, "sine");
}
