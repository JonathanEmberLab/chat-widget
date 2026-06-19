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
    button.style.transition = 'transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s ease';
    button.innerHTML = ICON_CHAT;
    button.addEventListener('click', toggle);
    button.addEventListener('mouseenter', function () {
      button.style.transform = 'scale(1.08)';
      button.style.boxShadow = '0 6px 22px rgba(0,0,0,0.30)';
    });
    button.addEventListener('mouseleave', function () {
      button.style.transform = open ? 'rotate(90deg)' : 'scale(1)';
      button.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    });
    document.body.appendChild(button);
  }

  var ICON_CHAT =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" ' +
    'stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_CLOSE =
    '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M4 4l14 14M18 4L4 18" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';

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
      // Closed state — animated in on open.
      opacity: '0', transform: 'translateY(16px) scale(0.96)', transformOrigin: 'bottom right',
      transition: 'opacity 0.25s ease, transform 0.28s cubic-bezier(0.22,1,0.36,1)',
    });
    // Responsive: full width on small screens
    if (window.matchMedia('(max-width: 480px)').matches) {
      Object.assign(iframe.style, { width: 'calc(100vw - 32px)', right: '16px', bottom: '92px' });
    }
    document.body.appendChild(iframe);
  }

  var closeTimer;
  function toggle() {
    open = !open;
    if (open) {
      clearTimeout(closeTimer);
      iframe.style.display = 'block';
      // Force a reflow so the transition runs from the closed state.
      void iframe.offsetHeight;
      iframe.style.opacity = '1';
      iframe.style.transform = 'translateY(0) scale(1)';
      button.style.transform = 'rotate(90deg)';
      button.innerHTML = ICON_CLOSE;
    } else {
      iframe.style.opacity = '0';
      iframe.style.transform = 'translateY(16px) scale(0.96)';
      closeTimer = setTimeout(function () { iframe.style.display = 'none'; }, 280);
      button.style.transform = 'scale(1)';
      button.innerHTML = ICON_CHAT;
    }
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
