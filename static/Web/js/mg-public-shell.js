/**
 * Load shared header/footer and mark active nav from body[data-mg-page].
 */
(function () {
  function setFooterYear() {
    var y = document.getElementById('mg-footer-year');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  function highlightNav() {
    var page = document.body.getAttribute('data-mg-page');
    if (!page) return;
    document.querySelectorAll('[data-mg-nav]').forEach(function (el) {
      if (el.getAttribute('data-mg-nav') === page) {
        el.classList.add('active');
      }
    });
  }

  async function inject(id, url) {
    var host = document.getElementById(id);
    if (!host) return;
    try {
      var res = await fetch(url);
      if (!res.ok) throw new Error('fetch ' + url);
      host.innerHTML = await res.text();
      highlightNav();
      setFooterYear();
    } catch (e) {
      console.warn('MG public shell:', e.message);
      host.innerHTML =
        '<p class="text-center text-muted py-3 small">Navigation could not be loaded. Open this site from the server (e.g. localhost:3000/Web/…).</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    inject('mg-header-root', 'partials/header.html');
    inject('mg-footer-root', 'partials/footer.html');
  });
})();
