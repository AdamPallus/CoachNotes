const wrapupCelebration = (() => {
  function flourish(section) {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return () => {};
    const canvas = document.createElement('canvas');
    canvas.className = 'wrapup-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    section.append(canvas);
    const width = section.clientWidth, height = section.clientHeight;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * scale; canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    const styles = getComputedStyle(section);
    const colors = ['--moss', '--highlight', '--clay', '--amber'].map(token => styles.getPropertyValue(token).trim());
    const pieces = Array.from({ length: 64 }, (_, i) => ({
      x: width / 2 + (i % 2 ? 26 : -26), y: 78,
      vx: (Math.random() - 0.5) * width * 0.95, vy: -70 - Math.random() * 170,
      turn: Math.random() * 8, angle: Math.random() * Math.PI,
      color: colors[i % colors.length], width: 4 + Math.random() * 4
    }));
    let frame;
    const started = performance.now();
    const stop = () => { cancelAnimationFrame(frame); canvas.remove(); section.classList.remove('is-celebrating'); motion.removeEventListener('change', stop); };
    function draw(now) {
      const t = (now - started) / 1000;
      if (t > 2.4 || !canvas.isConnected || !section.closest('dialog')?.open) { stop(); return; }
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = Math.min(1, Math.max(0, (2.4 - t) / 0.7));
      for (const piece of pieces) {
        ctx.save(); ctx.translate(piece.x + piece.vx * t, piece.y + piece.vy * t + 145 * t * t);
        ctx.rotate(piece.angle + piece.turn * t); ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.width / 2, -3, piece.width, 6); ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    }
    section.classList.add('is-celebrating');
    motion.addEventListener('change', stop);
    frame = requestAnimationFrame(draw);
    return stop;
  }
  function mount(section, day, celebrate) {
    let disposed = false, stop = () => {};
    const message = section.querySelector('.wrapup-closing-message');
    const start = performance.now();
    const enabled = () => state.settings?.wrapupCelebrations !== false;
    const visible = () => !disposed && section.isConnected && section.closest('dialog')?.open && enabled();
    (async () => {
      const result = await window.coachNotes.completeWrapup({ day, celebrate });
      if (result.fresh && visible()) stop = flourish(section);
      const closing = result.fresh || result.pending
        ? await window.coachNotes.generateWrapupClosing({ day }) : result;
      if (result.fresh) await new Promise(resolve => setTimeout(resolve, Math.max(0, 2600 - (performance.now() - start))));
      if (closing.message && visible()) {
        message.textContent = closing.message;
        message.classList.add('is-ready');
      }
    })().catch(() => { /* Never turn a completed day into an error dialog. */ });
    return () => { disposed = true; stop(); };
  }
  return { mount };
})();
