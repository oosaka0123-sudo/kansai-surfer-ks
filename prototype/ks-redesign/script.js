(() => {
  const header = document.querySelector('[data-header]');
  const button = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-nav]');
  const position = document.querySelector('[data-position]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const syncHeader = () => header?.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();

  button?.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('is-open', !open);
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    button?.setAttribute('aria-expanded', 'false');
    nav?.classList.remove('is-open');
  }));

  const revealTargets = [...document.querySelectorAll('.reveal-title,.motion-card')];
  if (reduced || !('IntersectionObserver' in window)) revealTargets.forEach(el => el.classList.add('is-visible'));
  else {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: '0px 0px -7% 0px' });
    revealTargets.forEach(el => revealObserver.observe(el));
  }

  const sections = [...document.querySelectorAll('.section-watch')];
  if (position && sections.length && 'IntersectionObserver' in window) {
    const number = position.querySelector('.position-number');
    const label = position.querySelector('.position-label');
    const fill = position.querySelector('.position-line i');
    const sectionObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const el = visible.target;
      number.textContent = el.dataset.sectionNumber || '01';
      label.textContent = el.dataset.section || '';
      const index = Math.max(0, sections.indexOf(el));
      fill.style.height = `${((index + 1) / sections.length) * 100}%`;
    }, { threshold: [0.25,.45,.65] });
    sections.forEach(el => sectionObserver.observe(el));
  }
})();
