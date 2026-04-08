/* =============================================
   TenderLens Landing Page – Interactions
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  /* ── Navbar scroll effect ── */
  const navbar = document.querySelector('.navbar');
  const onScroll = () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Theme toggle ── */
  const toggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('tl-theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light');
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      localStorage.setItem('tl-theme', isLight ? 'light' : 'dark');
    });
  }

  /* ── Mobile hamburger ── */
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('open');
      document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Scroll-triggered reveals ── */
  const revealElements = document.querySelectorAll('.feature-card, .step-card');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const delay = Array.from(revealElements).indexOf(el) % 3;
            setTimeout(() => {
              el.classList.add('visible');
            }, delay * 120);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15 },
    );

    revealElements.forEach((el) => observer.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('visible'));
  }

  /* ── Smooth scroll for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
