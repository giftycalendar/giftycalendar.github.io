// Pagina per aprire un regalo di Gifty dal browser (per chi non ha un iPhone).
const CK = {
  container: 'iCloud.com.alessia.giftcalendar',
  environment: 'production',
  token: '9bca7e3233571a60397df01695f4c94004ae0384b5a0ee8a2b7c806a8f5b0ee4',
};
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ2346789';
const CODE_LENGTH = 8;

// Stessi colori dell'app (CalendarTheme.swift).
const THEMES = {
  santaFireplace: { bg: ['#8E2424', '#3B0D0D'], door: '#C0392B', text: '#FFFFFF', accent: '#F5C46B' },
  giftMountain: { bg: ['#5B2A86', '#2E1A47'], door: '#E84A5F', text: '#FFFFFF', accent: '#FFD166' },
  snowyForest: { bg: ['#1F4E79', '#0B1D3A'], door: '#F4F8FB', text: '#1F4E79', accent: '#A8DADC' },
  goldenNight: { bg: ['#16382A', '#06140E'], door: '#1B4332', text: '#E6C66E', accent: '#D4AF37' },
  gingerbread: { bg: ['#FBEFE1', '#E8C9A6'], door: '#A0522D', text: '#FFF4E0', accent: '#C0392B' },
};
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', mov: 'video/mp4', mp4: 'video/mp4', m4v: 'video/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav', pdf: 'application/pdf' };
const DEFAULT_EXT = { photo: 'jpg', video: 'mov', voice: 'm4a', pdf: 'pdf' };

const $ = (sel) => document.querySelector(sel);
let gift = null;
let code = '';

function isApple() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function normalize(input) {
  return [...input.toUpperCase()].filter((c) => ALPHABET.includes(c)).join('');
}
function formatted(c) {
  return c.length === CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

// La casella N si apre dal giorno N dicembre, ora locale (come DoorUnlockPolicy.swift).
function unlockDate(day, year) {
  return new Date(year, 11, day);
}
function isUnlocked(day, year, now = new Date()) {
  return now >= unlockDate(day, year);
}

function openedKey() {
  return `gifty-opened-${code}`;
}
function openedDays() {
  try {
    return new Set(JSON.parse(localStorage.getItem(openedKey()) || '[]'));
  } catch {
    return new Set();
  }
}
function markOpened(day) {
  try {
    const set = openedDays();
    set.add(day);
    localStorage.setItem(openedKey(), JSON.stringify([...set]));
  } catch {}
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}
function showError(message) {
  $('#code-error').textContent = message;
  $('#code-error').hidden = !message;
}

async function fetchGift(c) {
  const url = `https://api.apple-cloudkit.com/database/1/${CK.container}/${CK.environment}/public/records/lookup?ckAPIToken=${CK.token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [{ recordName: c }] }),
  });
  if (!res.ok) throw new Error('Non riesco a collegarmi. Controlla la connessione e riprova.');
  const json = await res.json();
  const record = json.records && json.records[0];
  if (!record || record.serverErrorCode === 'NOT_FOUND') {
    throw new Error('Non trovo nessun regalo con questo codice. Controlla di averlo scritto bene.');
  }
  if (record.serverErrorCode) throw new Error('Non riesco ad aprire il regalo. Riprova tra poco.');
  const asset = record.fields && record.fields.package && record.fields.package.value;
  if (!asset || !asset.downloadURL) throw new Error('Questo regalo è vuoto o non è più disponibile.');
  const fileRes = await fetch(asset.downloadURL.replace('${f}', 'regalo.avvento'));
  if (!fileRes.ok) throw new Error('Non riesco a scaricare il regalo. Riprova tra poco.');
  return parseBplist(await fileRes.arrayBuffer());
}

async function openGift(input) {
  const c = normalize(input);
  if (c.length !== CODE_LENGTH) {
    showError('Il codice ha 8 caratteri, per esempio K7P4-M2QX.');
    return;
  }
  showError('');
  showScreen('loading');
  try {
    gift = await fetchGift(c);
    code = c;
    history.replaceState(null, '', `?c=${formatted(c)}`);
    renderCalendar();
  } catch (e) {
    showScreen('start');
    showError(e.message);
  }
}

function applyTheme() {
  const theme = THEMES[gift.theme] || THEMES.santaFireplace;
  const root = document.documentElement.style;
  root.setProperty('--bg1', theme.bg[0]);
  root.setProperty('--bg2', theme.bg[1]);
  root.setProperty('--door', theme.door);
  root.setProperty('--door-text', theme.text);
  root.setProperty('--accent', theme.accent);
  const light = gift.theme === 'gingerbread';
  root.setProperty('--fg', light ? '#4A2511' : '#FFFFFF');
}

function renderCalendar() {
  applyTheme();
  $('#cal-title').textContent = gift.title || "Il tuo calendario dell'Avvento";
  const parts = [];
  if (gift.recipientName) parts.push(`Per ${gift.recipientName}`);
  if (gift.senderName) parts.push(`da ${gift.senderName}`);
  $('#cal-subtitle').textContent = parts.join(', ');

  const now = new Date();
  const opened = openedDays();
  const order = gift.doorOrder && gift.doorOrder.length ? gift.doorOrder : gift.doors.map((d) => d.day);
  const grid = $('#doors');
  grid.innerHTML = '';
  for (const day of order) {
    const door = gift.doors.find((d) => d.day === day);
    if (!door) continue;
    const btn = document.createElement('button');
    btn.className = 'door';
    const unlocked = isUnlocked(day, gift.year, now);
    if (!unlocked) btn.classList.add('locked');
    if (opened.has(day)) btn.classList.add('opened');
    btn.innerHTML = `<span class="num">${day}</span>${unlocked ? '' : '<span class="lock" aria-hidden="true">🔒</span>'}`;
    btn.setAttribute('aria-label', unlocked ? `Casella ${day}` : `Casella ${day}, si apre il ${day} dicembre`);
    btn.addEventListener('click', () => (unlocked ? openDoor(door) : showLocked(day)));
    grid.appendChild(btn);
  }

  const first = unlockDate(1, gift.year);
  // Su iPhone e iPad propone l'app, che apre il regalo senza scrivere il codice.
  $('#ios-box').hidden = !isApple();
  $('#open-in-app').href = `giftycalendar://regalo/${code}`;

  $('#cal-note').textContent = now < first
    ? `Le caselle si aprono una al giorno, dal 1° dicembre ${gift.year}.`
    : 'Tocca la casella di oggi per scoprire la sorpresa. Quelle dei giorni passati restano apribili.';
  showScreen('calendar');
}

function showLocked(day) {
  const today = new Date();
  const days = Math.ceil((unlockDate(day, gift.year) - today) / 86400000);
  openSheet(`<p class="locked-msg">🎁 Ancora un po' di pazienza!<br>Questa casella si apre il <strong>${day} dicembre</strong>${days > 0 ? ` (tra ${days} ${days === 1 ? 'giorno' : 'giorni'})` : ''}.</p>`);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function blobURL(content) {
  const ext = (content.fileName || '').split('.').pop().toLowerCase() || DEFAULT_EXT[content.kind];
  const type = MIME[ext] || 'application/octet-stream';
  return { url: URL.createObjectURL(new Blob([content.data], { type })), ext };
}
function safeLink(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function openDoor(door) {
  markOpened(door.day);
  let html = `<p class="sheet-day">${door.day} dicembre</p>`;
  if (door.title) html += `<h2>${esc(door.title)}</h2>`;
  if (door.message) html += `<p class="message">${esc(door.message).replace(/\n/g, '<br>')}</p>`;
  for (const content of door.contents || []) {
    const caption = content.text ? `<p class="caption">${esc(content.text)}</p>` : '';
    if (content.kind === 'link') {
      const href = safeLink(content.urlString);
      if (href) html += `<a class="button" href="${esc(href)}" target="_blank" rel="noopener">${esc(content.text || 'Apri il link')}</a>`;
      continue;
    }
    if (!content.data) continue;
    const { url, ext } = blobURL(content);
    if (content.kind === 'photo') {
      html += `<img src="${url}" alt="${esc(content.text || 'Foto')}">${caption}`;
    } else if (content.kind === 'video') {
      html += `<video src="${url}" controls playsinline preload="metadata"></video>${caption}<a class="small" href="${url}" download="video.${ext}">Il video non parte? Scaricalo</a>`;
    } else if (content.kind === 'voice') {
      html += `<p class="caption">🎙️ ${esc(content.text || 'Un messaggio vocale per te')}</p><audio src="${url}" controls preload="metadata"></audio>`;
    } else if (content.kind === 'pdf') {
      html += `<a class="button" href="${url}" target="_blank" download="${esc(content.fileName || 'regalo.pdf')}">📄 ${esc(content.text || 'Apri il PDF')}</a>`;
    }
  }
  openSheet(html);
  renderCalendar();
}

function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').showModal();
}

document.addEventListener('DOMContentLoaded', () => {
  $('#code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    openGift($('#code-input').value);
  });
  $('#sheet-close').addEventListener('click', () => $('#sheet').close());
  $('#sheet').addEventListener('close', () => {
    for (const m of $('#sheet-body').querySelectorAll('video, audio')) m.pause();
  });
  $('#change-code').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    gift = null;
    showScreen('start');
  });
  const fromURL = new URLSearchParams(location.search).get('c');
  const urlCode = fromURL ? normalize(fromURL) : '';
  if (urlCode.length === CODE_LENGTH && isApple()) {
    // Su iPhone il regalo si vive nell'app: il browser resta solo un'alternativa.
    $('#code-input').value = fromURL;
    $('#app-first-code').textContent = formatted(urlCode);
    $('#app-first-open').href = `giftycalendar://regalo/${urlCode}`;
    $('#app-first-web').addEventListener('click', () => openGift(urlCode));
    showScreen('app-first');
  } else if (fromURL) {
    $('#code-input').value = fromURL;
    openGift(fromURL);
  } else {
    showScreen('start');
  }
});
