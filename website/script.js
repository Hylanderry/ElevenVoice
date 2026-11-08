// Level meter: a quiet waveform whose two tallest columns form the "11" of the logo.
(() => {
  const meter = document.querySelector('[data-meter]');
  if (!meter) return;
  const count = window.matchMedia('(max-width: 640px)').matches ? 22 : 30;
  const ones = [Math.round(count * 0.42), Math.round(count * 0.58)];
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('span');
    const x = i / (count - 1);
    // Deterministic envelope with a little texture, so the shape is stable on every visit.
    const envelope = 0.18 + 0.5 * Math.sin(Math.PI * x) ** 1.4;
    const texture = 0.12 * Math.abs(Math.sin(i * 2.3)) + 0.06 * Math.abs(Math.cos(i * 5.1));
    let height = Math.min(envelope + texture, 0.78);
    if (i === ones[0]) {
      height = 1;
      bar.className = 'is-one';
    } else if (i === ones[1]) {
      height = 0.86;
      bar.className = 'is-one is-peak';
    }
    bar.style.setProperty('--h', `${Math.round(height * 100)}%`);
    bar.style.setProperty('--d', `${(i * 22).toFixed(0)}ms`);
    meter.append(bar);
  }
})();

// Install tabs (roving tabindex, arrow keys).
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    for (const other of tabs) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden = !on;
    }
    tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      select(tabs[(index + step + tabs.length) % tabs.length]);
    });
  });
  // Show the command for the visitor's own system first.
  if (!/windows/i.test(navigator.userAgent) && tabs[1]) {
    for (const other of tabs) {
      const on = other === tabs[1];
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden = !on;
    }
  }
})();

// Copy buttons.
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const code = button.parentElement.querySelector('code').textContent.trim();
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy';
    }
    setTimeout(() => (button.textContent = 'Copy'), 1800);
  });
});

// Live GitHub star count, cached for the session.
(async () => {
  const targets = [...document.querySelectorAll('[data-stars]')];
  if (!targets.length) return;
  const key = 'elevenvoice-stars';
  const show = (n) => {
    const text = n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
    for (const target of targets) target.textContent = text;
  };
  try {
    const cached = sessionStorage.getItem(key);
    if (cached !== null) return show(Number(cached));
  } catch {}
  try {
    const response = await fetch('https://api.github.com/repos/Hylanderry/ElevenVoice', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return;
    const { stargazers_count: stars } = await response.json();
    if (typeof stars !== 'number') return;
    show(stars);
    try {
      sessionStorage.setItem(key, String(stars));
    } catch {}
  } catch {
    // Offline or rate-limited: the placeholder stays.
  }
})();

// Install card: name the visitor's system and point the button at the right command.
(() => {
  const name = document.querySelector('[data-os-name]');
  const icon = document.querySelector('[data-os-icon]');
  if (!name || !icon) return;
  const ua = navigator.userAgent;
  const os = /windows/i.test(ua) ? 'Windows' : /mac os|macintosh/i.test(ua) ? 'macOS' : /linux|x11/i.test(ua) ? 'Linux' : 'Windows';
  const icons = {
    Windows: '<svg viewBox="0 0 16 16"><path d="M0 2.3 6.5 1.4v6.2H0zm7.3-1 8.7-1.3v7.6H7.3zM0 8.4h6.5v6.2L0 13.7zm7.3 0H16V16l-8.7-1.2z"/></svg>',
    macOS: '<svg viewBox="0 0 16 16"><path d="M11.2 8.5c0-1.8 1.5-2.7 1.6-2.8-.9-1.3-2.2-1.4-2.7-1.5-1.1-.1-2.2.7-2.8.7s-1.5-.7-2.4-.6c-1.3 0-2.4.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6 1.6-.9 2.2-1.8c.7-1 1-2 1-2.1-.1 0-1.9-.7-1.9-2.8zM9.4 3.1c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1z"/></svg>',
    Linux: '<svg viewBox="0 0 16 16"><path d="M8 1c-1.7 0-2.6 1.4-2.6 3.3 0 1-.3 1.6-.9 2.5C3.6 8 2.8 9.4 2.8 11c0 .6.2 1 .5 1.3-.5.4-.8.9-.6 1.4.3.8 1.6.7 2.6 1 1 .3 1.8.8 2.7.3.9.5 1.7 0 2.7-.3s2.3-.2 2.6-1c.2-.5-.1-1-.6-1.4.3-.3.5-.7.5-1.3 0-1.6-.8-3-1.7-4.2-.6-.9-.9-1.5-.9-2.5C10.6 2.4 9.7 1 8 1z"/></svg>',
  };
  name.textContent = os;
  icon.innerHTML = icons[os];
})();
