/* «Беспилотная авиация» — мост для встраивания в Tilda T123 (iframe GitHub Pages).
 *
 * Работает только внутри iframe: сообщает родительской странице высоту контента,
 * готовность страницы и навигационные переходы, чтобы блок T123 мог
 * автоматически подстраивать высоту и корректно прокручиваться.
 *
 * При прямом открытии (не в iframe) скрипт ничего не делает.
 */
(function () {
  'use strict';

  var parent = window.parent;
  if (!parent || parent === window) return; // не во iframe

  var PREFIX = 'bpla';

  function currentPage() {
    return location.pathname + location.search;
  }

  function send(msg) {
    try {
      parent.postMessage(msg, '*');
    } catch (_) {
      /* ignore */
    }
  }

  function reportHeight() {
    var doc = document.documentElement;
    var body = document.body;
    var h = Math.max(
      doc ? doc.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      doc ? doc.offsetHeight : 0
    );
    send({ type: PREFIX + '-height', height: h, page: currentPage() });
  }

  function reportReady(navigationType) {
    send({
      type: PREFIX + '-ready',
      page: currentPage(),
      navigationType: navigationType || ''
    });
  }

  /* --- Наблюдение за изменением высоты (ResizeObserver + resize + load) --- */
  function observeHeight() {
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () {
        reportHeight();
      });
      if (document.documentElement) ro.observe(document.documentElement);
      if (document.body) ro.observe(document.body);
    }
  }

  window.addEventListener('resize', reportHeight);
  window.addEventListener('load', reportHeight);
  window.addEventListener('pageshow', function (e) {
    reportReady(e.persisted ? 'back_forward' : 'load');
    reportHeight();
  });

  /* --- Переходы по внутренним ссылкам (смена документа) --- */
  document.addEventListener(
    'click',
    function (e) {
      var el = e.target;
      var a = el && el.closest ? el.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      // Пропускаем внешние ссылки и якоря внутри текущего документа.
      if (!href || href.charAt(0) === '#') return;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.indexOf('//') === 0) return;
      send({ type: PREFIX + '-navigation', from: currentPage(), to: href });
    },
    true
  );

  /* --- Первичная инициализация --- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      reportReady('load');
      reportHeight();
      observeHeight();
    });
  } else {
    reportReady('load');
    reportHeight();
    observeHeight();
  }
})();
