import { animate, onScroll, stagger } from './vendor/anime-4.5.0.esm.min.js';
import Lenis from './vendor/lenis-1.3.27.mjs';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(key, area = localStorage) {
    try { return JSON.parse(area.getItem(key)); } catch { return null; }
  },
  set(key, value, area = localStorage) {
    try { area.setItem(key, JSON.stringify(value)); } catch {}
  },
};

if (!reduced) root.classList.add('motion');

/* ───────── Hero meter: the two tallest bars are the "11" of the logo ───────── */
const meter = $('[data-meter]');
if (meter) {
  const count = innerWidth < 640 ? 18 : 34;
  const ones = [Math.round(count * 0.44), Math.round(count * 0.56)];
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('span');
    const x = i / (count - 1);
    let h = 0.16 + 0.46 * Math.sin(Math.PI * x) ** 1.6 + 0.1 * Math.abs(Math.sin(i * 2.3));
    if (i === ones[0]) { h = 0.98; bar.className = 'is-one'; }
    if (i === ones[1]) { h = 0.86; bar.className = 'is-one is-peak'; }
    bar.style.setProperty('--h', `${Math.round(Math.min(h, 1) * 100)}%`);
    meter.append(bar);
  }
}

/* ───────── Split headline into words ───────── */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
  el.innerHTML = words
    .map((w) => `<span class="word" aria-hidden="true"><span>${w}</span></span>`)
    .join(' ');
  return $$('.word > span', el);
}
const heroWords = $('[data-split]') ? splitWords($('[data-split]')) : [];
const ctaWords = $('[data-split-cta]') ? splitWords($('[data-split-cta]')) : [];

/* ───────── Smooth scroll ───────── */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, syncTouch: false });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: -80, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  });
});

const nav = $('[data-nav]');
/* ───────── Mobile menu ───────── */
const menuButton = $('[data-menu]');
const setMenu = (open) => {
  if (!nav || !menuButton) return;
  nav.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
menuButton?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
$$('#site-menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

/* ───────── Nav hides on scroll down, returns on scroll up ───────── */
let lastY = scrollY;
const onScrollNav = (y) => {
  if (nav && !nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > 400 && y > lastY + 2);
  if (y < lastY - 2 && nav) nav.classList.remove('is-hidden');
  lastY = y;
};

/* ───────── Parallax driven by scroll (cheap: transforms only) ───────── */
const layers = $$('[data-depth], [data-float]').map((el) => ({
  el,
  k: Number(el.dataset.depth ?? el.dataset.float),
}));
const marquee = $('[data-marquee]');
function frame() {
  const vh = innerHeight;
  for (const { el, k } of innerWidth < 960 ? [] : layers) {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) continue;
    const d = r.top + r.height / 2 - vh / 2;
    el.style.transform = `translate3d(0, ${(d * k).toFixed(1)}px, 0)`;
  }
  if (marquee) {
    const r = marquee.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) marquee.style.transform = `translate3d(${(-(vh - r.top) * 0.35).toFixed(1)}px,0,0)`;
  }
}
if (!reduced) {
  const tick = () => { onScrollNav(scrollY); frame(); };
  if (lenis) lenis.on('scroll', tick);
  else addEventListener('scroll', tick, { passive: true });
  frame();
}

/* ───────── Scroll-synced animations (anime.js) ───────── */
function scrollMotion() {
  if (reduced) return;
  const stage = $('[data-stage]');
  if (stage) {
    animate(stage, {
      rotateX: [coarse ? 8 : 18, 0],
      scale: [0.9, 1],
      y: [60, 0],
      ease: 'linear',
      autoplay: onScroll({ target: stage, enter: 'bottom top', leave: 'center center', sync: 0.4 }),
    });
  }
  if (meter) {
    animate($$('span', meter), {
      scaleY: [1, 0.3],
      opacity: [1, 0],
      delay: stagger(8, { from: 'center' }),
      ease: 'linear',
      autoplay: onScroll({ target: $('.hero'), enter: 'top top', leave: 'bottom top', sync: true }),
    });
  }
}

/* ───────── Reveal on enter ───────── */
function reveals() {
  if (reduced) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const el = entry.target;
        const group = el.matches('[data-tiles], [data-pro-list], [data-rows]');
        animate(group ? [...el.children] : el, {
          opacity: [0, 1],
          y: [36, 0],
          duration: 900,
          delay: group ? stagger(70) : 0,
          ease: 'out(4)',
        });
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  $$('[data-reveal], [data-tiles], [data-pro-list], [data-rows]').forEach((el) => io.observe(el));

  if (ctaWords.length) {
    ctaWords.forEach((w) => (w.style.transform = 'translateY(110%)'));
    const ctaIo = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      ctaIo.disconnect();
      animate(ctaWords, { y: ['110%', '0%'], duration: 1000, delay: stagger(45), ease: 'out(4)' });
    }, { rootMargin: '0px 0px -15% 0px' });
    ctaIo.observe($('[data-split-cta]'));
  }
}

/* ───────── Sticky story: screenshot follows the active step ───────── */
function story() {
  const steps = $$('[data-step]');
  const shots = $$('[data-shot]');
  const bar = $('[data-progress]');
  if (!steps.length) return;
  const setActive = (i) => {
    steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
    shots.forEach((s, n) => s.classList.toggle('is-active', n === i));
  };
  setActive(0);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number(e.target.dataset.step));
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  steps.forEach((s) => io.observe(s));
  if (bar && !reduced) {
    animate(bar, {
      scaleX: [0, 1],
      ease: 'linear',
      autoplay: onScroll({ target: $('.story-steps'), enter: 'center top', leave: 'center bottom', sync: true }),
    });
  }
}

/* ───────── Intro: loader once per visit, then the hero rises ───────── */
let introStarted = false;
function intro() {
  if (introStarted) return;
  introStarted = true;
  const finish = () => {
    root.classList.add('is-ready');
    store.set('ev-intro', 1, sessionStorage);
    if (reduced) return;
    if (heroWords.length) {
      animate(heroWords, { y: ['110%', '0%'], duration: 1100, delay: stagger(55), ease: 'out(4)' });
    }
    animate($$('[data-rise]'), {
      opacity: [0, 1],
      y: [24, 0],
      duration: 1000,
      delay: stagger(90, { start: 260 }),
      ease: 'out(4)',
    });
    if (meter) {
      animate($$('span', meter), {
        scaleY: [0, 1],
        duration: 1200,
        delay: stagger(18, { from: 'center' }),
        ease: 'out(3)',
      });
    }
  };
  if (!reduced) heroWords.forEach((w) => (w.style.transform = 'translateY(110%)'));
  if (root.classList.contains('skip-intro')) return finish();
  const counter = $('[data-count]');
  const state = { n: 0 };
  animate(state, {
    n: 100,
    duration: 1100,
    ease: 'inOut(3)',
    onUpdate: () => counter && (counter.textContent = String(Math.round(state.n)).padStart(2, '0')),
    onComplete: finish,
  });
}

/* ───────── Install tabs ───────── */
(() => {
  const tabs = $$('[role="tab"]');
  const select = (tab, focus = true) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      select(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]);
    });
  });
  if (!/windows/i.test(navigator.userAgent) && tabs[1]) select(tabs[1], false);
})();

$$('[data-copy]').forEach((button) => {
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

/* ───────── Visitor's OS ───────── */
(() => {
  const ua = navigator.userAgent;
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|mac os|macintosh/i.test(ua) ? 'macOS' : /android|linux|x11/i.test(ua) ? 'Linux' : 'Windows';
  const icons = {
    Windows: '<svg viewBox="0 0 16 16"><path d="M0 2.3 6.5 1.4v6.2H0zm7.3-1 8.7-1.3v7.6H7.3zM0 8.4h6.5v6.2L0 13.7zm7.3 0H16V16l-8.7-1.2z"/></svg>',
    macOS: '<svg viewBox="0 0 16 16"><path d="M11.2 8.5c0-1.8 1.5-2.7 1.6-2.8-.9-1.3-2.2-1.4-2.7-1.5-1.1-.1-2.2.7-2.8.7s-1.5-.7-2.4-.6c-1.3 0-2.4.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6 1.6-.9 2.2-1.8c.7-1 1-2 1-2.1-.1 0-1.9-.7-1.9-2.8zM9.4 3.1c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1z"/></svg>',
    Linux: '<svg viewBox="0 0 16 16"><path d="M8 1c-1.7 0-2.6 1.4-2.6 3.3 0 1-.3 1.6-.9 2.5C3.6 8 2.8 9.4 2.8 11c0 .6.2 1 .5 1.3-.5.4-.8.9-.6 1.4.3.8 1.6.7 2.6 1 1 .3 1.8.8 2.7.3.9.5 1.7 0 2.7-.3s2.3-.2 2.6-1c.2-.5-.1-1-.6-1.4.3-.3.5-.7.5-1.3 0-1.6-.8-3-1.7-4.2-.6-.9-.9-1.5-.9-2.5C10.6 2.4 9.7 1 8 1z"/></svg>',
  };
  const name = $('[data-os-name]');
  const icon = $('[data-os-icon]');
  if (name) name.textContent = os;
  if (icon) icon.innerHTML = icons[os];
  root.dataset.os = os;
})();

/* ───────── GitHub: stars and the latest Windows installer (cached 6 h) ───────── */
const REPO = 'Hylanderry/ElevenVoice';
async function github(path, key) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.t < 6 * 3600e3) return hit.v;
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(String(res.status));
  const v = await res.json();
  store.set(key, { t: Date.now(), v });
  return v;
}
(async () => {
  try {
    const { stargazers_count: n } = await github('', 'ev-repo');
    if (typeof n !== 'number') return;
    const text = n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
    $$('[data-stars]').forEach((el) => (el.textContent = text));
  } catch {}
})();
(async () => {
  try {
    const release = await github('/releases/latest', 'ev-release');
    const exe = (release.assets || []).find((a) => /\.exe$/i.test(a.name) && !/blockmap/i.test(a.name));
    if (!exe) return localStorage.removeItem('ev-release');
    const mb = Math.round(exe.size / 1048576);
    $('[data-dl-meta]').textContent = `${release.tag_name} · .exe · ${mb} MB`;
  } catch {}
})();

/* ───────── Direct download: the .exe starts downloading right here ───────── */
(() => {
  const toast = $('[data-toast]');
  let timer;
  const hide = () => toast && (toast.hidden = true);
  $('[data-toast-close]')?.addEventListener('click', hide);
  if (root.dataset.os !== 'Windows') {
    // Not on Windows: these buttons lead to the install command instead.
    $$('[data-exe-nav], [data-download-primary]').forEach((a) => {
      a.href = '#download';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (lenis) lenis.scrollTo($('#download'), { offset: -80, duration: 1.4 });
        else $('#download').scrollIntoView();
      });
    });
  }
  $$('[data-exe]').forEach((a) =>
    a.addEventListener('click', () => {
      if (a.getAttribute('href') !== '/download/windows' || !toast) return;
      toast.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(hide, 9000);
    }),
  );
})();

/* ───────── Quick translation: device language first, then the visitor's country ───────── */
const LANGS = [
  ['en', 'English'], ['pt', 'Português'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['ru', 'Русский'], ['uk', 'Українська'],
  ['tr', 'Türkçe'], ['ar', 'العربية'], ['fa', 'فارسی'], ['iw', 'עברית'], ['hi', 'हिन्दी'],
  ['bn', 'বাংলা'], ['ur', 'اردو'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['vi', 'Tiếng Việt'],
  ['th', 'ไทย'], ['tl', 'Filipino'], ['ja', '日本語'], ['ko', '한국어'], ['zh-CN', '简体中文'],
  ['zh-TW', '繁體中文'], ['sv', 'Svenska'], ['no', 'Norsk'], ['da', 'Dansk'], ['fi', 'Suomi'],
  ['el', 'Ελληνικά'], ['cs', 'Čeština'], ['sk', 'Slovenčina'], ['ro', 'Română'], ['hu', 'Magyar'],
  ['bg', 'Български'], ['hr', 'Hrvatski'], ['sr', 'Српски'], ['ca', 'Català'], ['sw', 'Kiswahili'],
  ['af', 'Afrikaans'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['mr', 'मराठी'], ['gu', 'ગુજરાતી'],
];
const COUNTRY_LANG = {
  pt: 'BR PT AO MZ CV GW ST TL',
  es: 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ',
  fr: 'FR BE LU MC SN CI CM ML BF NE TG BJ GA CG CD MG HT',
  de: 'DE AT LI', it: 'IT SM', nl: 'NL SR', pl: 'PL', ru: 'RU BY KZ KG', uk: 'UA', tr: 'TR',
  ar: 'SA AE EG MA DZ TN IQ JO SY LB KW QA BH OM YE LY SD', fa: 'IR', iw: 'IL', hi: 'IN',
  bn: 'BD', ur: 'PK', id: 'ID', ms: 'MY', vi: 'VN', th: 'TH', tl: 'PH', ja: 'JP', ko: 'KR',
  'zh-CN': 'CN SG', 'zh-TW': 'TW HK MO', sv: 'SE', no: 'NO', da: 'DK', fi: 'FI', el: 'GR CY',
  cs: 'CZ', sk: 'SK', ro: 'RO MD', hu: 'HU', bg: 'BG', hr: 'HR', sr: 'RS', sw: 'KE TZ',
};
const known = new Set(LANGS.map(([c]) => c));
function normalizeLang(tag) {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (t.startsWith('zh')) return /tw|hk|mo|hant/.test(t) ? 'zh-TW' : 'zh-CN';
  const base = { he: 'iw', nb: 'no', nn: 'no', fil: 'tl' }[t.split('-')[0]] ?? t.split('-')[0];
  return known.has(base) ? base : null;
}
function readCookieLang() {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookieLang(code) {
  const parts = location.hostname.split('.');
  const domains = ['', location.hostname, parts.length > 2 ? '.' + parts.slice(-2).join('.') : ''];
  for (const d of domains) {
    const domain = d ? `;domain=${d}` : '';
    document.cookie = code === 'en'
      ? `googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domain}`
      : `googtrans=/en/${code};max-age=2592000;path=/${domain}`;
  }
}
function loadTranslator() {
  if (window.google?.translate || $('#gt-script')) return;
  const host = document.createElement('div');
  host.id = 'gt-host';
  host.hidden = true;
  document.body.append(host);
  window.evTranslateInit = () =>
    new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'gt-host');
  const script = document.createElement('script');
  script.id = 'gt-script';
  script.src = 'https://translate.google.com/translate_a/element.js?cb=evTranslateInit';
  script.async = true;
  document.head.append(script);
}
async function detectLang() {
  const saved = store.get('ev-lang');
  if (saved) return saved;
  for (const tag of navigator.languages || [navigator.language]) {
    const code = normalizeLang(tag);
    if (code && code !== 'en') return code;
    if (code === 'en') break;
  }
  try {
    const cached = store.get('ev-geo', sessionStorage);
    const country = cached ?? (await (await fetch('/api/geo')).json()).country;
    store.set('ev-geo', country, sessionStorage);
    for (const [code, list] of Object.entries(COUNTRY_LANG)) if (country && list.split(' ').includes(country)) return code;
  } catch {}
  return 'en';
}
(() => {
  const box = $('[data-lang]');
  if (!box) return;
  const button = $('[data-lang-button]');
  const panel = $('[data-lang-panel]');
  const list = $('[data-lang-list]');
  const search = $('[data-lang-search]');
  const codeLabel = $('[data-lang-code]');
  const label = (c) => (c === 'zh-CN' ? 'ZH' : c === 'zh-TW' ? 'ZH' : c === 'iw' ? 'HE' : c.toUpperCase());
  let current = readCookieLang() || 'en';
  codeLabel.textContent = label(current);
  list.innerHTML = LANGS.map(([c, n]) =>
    `<li role="option" tabindex="-1" data-code="${c}" aria-selected="${c === current}">${n}<small>${label(c)}</small></li>`).join('');
  const open = (on) => {
    panel.hidden = !on;
    button.setAttribute('aria-expanded', String(on));
    if (on) { search.value = ''; filter(''); setTimeout(() => search.focus(), 30); }
  };
  const filter = (q) => {
    q = q.trim().toLowerCase();
    for (const li of list.children) li.hidden = !!q && !li.textContent.toLowerCase().includes(q) && !li.dataset.code.includes(q);
  };
  const choose = (code) => {
    store.set('ev-lang', code);
    if (code === current) return open(false);
    writeCookieLang(code);
    location.reload();
  };
  button.addEventListener('click', () => open(panel.hidden));
  search.addEventListener('input', () => filter(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = [...list.children].find((li) => !li.hidden); if (first) choose(first.dataset.code); }
    if (e.key === 'Escape') open(false);
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) choose(li.dataset.code); });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) open(false); });

  if (current !== 'en') loadTranslator();
  else if (!store.get('ev-lang')) {
    // First visit: translate automatically when the device or the country points to another language.
    detectLang().then((code) => {
      if (code === 'en') return;
      writeCookieLang(code);
      current = code;
      codeLabel.textContent = label(code);
      for (const li of list.children) li.setAttribute("aria-selected", String(li.dataset.code === code));
      loadTranslator();
    });
  }
})();

/* ───────── Boot ───────── */
scrollMotion();
reveals();
story();
if (document.readyState === 'complete') intro();
else addEventListener('load', intro, { once: true });
// Never leave the loader up on a slow image.
setTimeout(intro, 2500);

if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
