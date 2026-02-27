"use client";

let unlocked = false;

export function unlockNotificationAudio() {
  if (unlocked) return;
  unlocked = true;

  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);

    o.start();
    o.stop(ctx.currentTime + 0.01);

    setTimeout(() => ctx.close?.(), 50);
  } catch {}
}

export function playNotificationBeep() {
  if (!unlocked) return;

  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.06;

    o.connect(g);
    g.connect(ctx.destination);

    const t0 = ctx.currentTime;
    o.start(t0);
    o.stop(t0 + 0.12);

    setTimeout(() => ctx.close?.(), 300);
  } catch {}
}
