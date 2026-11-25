/* «Беспилотная авиация» — демо-превью: интерактив. */
(function () {
  'use strict';

  /* --- Год в подвале --- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --- Мобильная навигация --- */
  var toggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.mobile-nav');

  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileNav.hidden = open;
      toggle.setAttribute('aria-label', open ? 'Открыть меню' : 'Закрыть меню');
    });
  }

  /* --- Reveal-анимации (IntersectionObserver) --- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* --- Hero-видео: честная демо-заглушка вместо несуществующего URL --- */
  var playBtn = document.querySelector('[data-play]');
  if (playBtn) {
    playBtn.addEventListener('click', function () {
      var note = document.querySelector('[data-poster-note]');
      if (!note) return;
      var visible = note.style.display === 'block';
      note.style.display = visible ? 'none' : 'block';
      playBtn.setAttribute(
        'aria-expanded',
        visible ? 'false' : 'true'
      );
    });
  }
})();
