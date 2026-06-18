(function () {
  'use strict';

  // Find this script tag to read config + derive the backend origin.
  var script = document.currentScript;
  var siteKey = script.getAttribute('data-site');
  if (!siteKey) {
    console.error('[chat-widget] Missing data-site attribute on the script tag.');
    return;
  }
  var origin = new URL(script.src).origin;
  var accent = script.getAttribute('data-accent') || '#1D1D1D';

  var open = false;
  var iframe, button;

  function buildButton() {
    button = document.createElement('button');
    button.setAttribute('aria-label', 'Open chat');
    Object.assign(button.style, {
      position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px',
      borderRadius: '50%', background: accent, border: 'none', cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: '2147483647',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    button.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" ' +
      'stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.addEventListener('click', toggle);
    document.body.appendChild(button);
  }

  function buildIframe() {
    iframe = document.createElement('iframe');
    iframe.src = origin + '/embed?site=' + encodeURIComponent(siteKey);
    iframe.setAttribute('title', 'Chat');
    Object.assign(iframe.style, {
      position: 'fixed', bottom: '92px', right: '24px',
      width: '370px', height: '70vh', maxHeight: '600px',
      border: 'none', borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,0,0,0.25)', zIndex: '2147483647',
      display: 'none', background: '#fff',
    });
    // Responsive: full width on small screens
    if (window.matchMedia('(max-width: 480px)').matches) {
      Object.assign(iframe.style, { width: 'calc(100vw - 32px)', right: '16px', bottom: '92px' });
    }
    document.body.appendChild(iframe);
  }

  function toggle() {
    open = !open;
    iframe.style.display = open ? 'block' : 'none';
    button.innerHTML = open
      ? '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M4 4l14 14M18 4L4 18" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // Allow the iframe to ask the host to close it.
  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    if (e.data && e.data.type === 'chat-widget:close' && open) toggle();
  });

  function init() {
    buildIframe();
    buildButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
