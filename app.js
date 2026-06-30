// Merchant page: amount + note -> pay URL + QR

const SETTINGS_KEY = 'qrpay.settings.v1';
const CAFE_TAG = 'Wobbles Cafe';

const MENU = [
  { name: 'Black Coffee', price: 2.00 },
  { name: 'Iced Coffee',  price: 4.50 },
  { name: 'Cold Brew',    price: 5.00 },
  { name: 'Milky Way',    price: 8.00 },
  { name: 'Wobble',       price: 8.00 },
];

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Populate settings inputs
const venmoInput  = document.getElementById('venmoHandle');
const jellyInput  = document.getElementById('jellyHandle');
const stripeInput = document.getElementById('stripeLink');
const saveStatus  = document.getElementById('saveStatus');

const DEFAULT_VENMO = 'iqram';
const s = loadSettings();
venmoInput.value  = s.venmo  || DEFAULT_VENMO;
jellyInput.value  = s.jelly  || '';
stripeInput.value = s.stripe || '';

document.getElementById('saveSettings').addEventListener('click', () => {
  saveSettings({
    venmo:  venmoInput.value.trim().replace(/^@/, ''),
    jelly:  jellyInput.value.trim().replace(/^@/, ''),
    stripe: stripeInput.value.trim(),
  });
  saveStatus.textContent = 'Saved ✓';
  setTimeout(() => saveStatus.textContent = '', 1800);
});

document.getElementById('openSettings').addEventListener('click', () => {
  setTimeout(() => document.getElementById('settings').scrollIntoView({ behavior: 'smooth' }), 10);
});

const amountInput = document.getElementById('amount');
const noteInput   = document.getElementById('note');

// Amount formatting: keep digits + one dot, max 2 dp
amountInput.addEventListener('input', (e) => {
  let v = e.target.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
  e.target.value = v;
});

document.getElementById('clearAmount').addEventListener('click', () => {
  amountInput.value = '';
  // Reset order tally + free-text note
  orderCounts = {};
  orderSequence = [];
  freeText = '';
  noteInput.value = '';
  amountInput.focus();
});

// Track quantities of tapped menu items + any free text the user typed/spoke
let orderCounts = {};       // { 'Black Coffee': 2, ... }
let orderSequence = [];     // ['Black Coffee', 'Iced Coffee'] in first-tap order
let freeText = '';          // anything the user typed before tapping items

function pluralize(name, count) {
  if (count <= 1) return name;
  // Simple pluralization for our menu ("Black Coffee" -> "Black Coffees")
  if (/y$/i.test(name)) return name.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(name)) return name + 'es';
  return name + 's';
}

function buildOrderNote() {
  const parts = orderSequence.map(n => {
    const c = orderCounts[n] || 0;
    if (c <= 0) return null;
    return `${c} ${pluralize(n, c)}`;
  }).filter(Boolean);
  const order = parts.join(', ');
  if (freeText && order) return `${freeText} - ${order}`;
  return freeText || order;
}

// Build the horizontal menu scroller
const menuScroll = document.getElementById('menuScroll');
MENU.forEach(item => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-item';
  btn.innerHTML = `<span class="name"></span><span class="price"></span>`;
  btn.querySelector('.name').textContent = item.name;
  btn.querySelector('.price').textContent = '$' + item.price.toFixed(2).replace(/\.00$/, '');
  btn.addEventListener('click', () => addMenuItem(item));
  menuScroll.appendChild(btn);
});

function addMenuItem(item) {
  const current = parseFloat(amountInput.value) || 0;
  const next = +(current + item.price).toFixed(2);
  amountInput.value = next.toFixed(2);

  // Capture any free-text the user typed *before* this tap (only on the first tap)
  if (orderSequence.length === 0) {
    const typed = noteInput.value.trim();
    // If what's in the box is *already* an auto-built order note from a prior round, ignore it.
    if (typed && typed !== buildOrderNote()) freeText = typed;
  }

  if (!(item.name in orderCounts)) orderSequence.push(item.name);
  orderCounts[item.name] = (orderCounts[item.name] || 0) + 1;

  noteInput.value = buildOrderNote();
}

// If the user edits the note manually, treat the whole field as free text and reset the tally.
noteInput.addEventListener('input', () => {
  const auto = buildOrderNote();
  if (noteInput.value !== auto) {
    freeText = noteInput.value;
    orderCounts = {};
    orderSequence = [];
  }
});

// Voice note via Web Speech API
const micBtn = document.getElementById('micBtn');
const micStatus = document.getElementById('micStatus');
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
let listening = false;

if (!SR) {
  micBtn.style.display = 'none';
} else {
  recog = new SR();
  recog.lang = 'en-US';
  recog.interimResults = true;
  recog.continuous = false;

  let baseText = '';
  recog.onstart = () => {
    listening = true;
    micBtn.classList.add('listening');
    micStatus.textContent = 'listening… tap mic to stop';
    baseText = noteInput.value ? noteInput.value.trim() + ' ' : '';
  };
  recog.onresult = (ev) => {
    let interim = '', final = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    noteInput.value = (baseText + final + interim).trim();
    if (final) baseText += final + ' ';
  };
  recog.onerror = (e) => { micStatus.textContent = 'mic error: ' + e.error; stopListening(); };
  recog.onend = () => {
    if (listening) { stopListening(); micStatus.textContent = ''; }
  };
}

function stopListening() {
  listening = false;
  micBtn.classList.remove('listening');
  try { recog && recog.stop(); } catch {}
}

micBtn.addEventListener('click', () => {
  if (!recog) return;
  if (listening) { stopListening(); micStatus.textContent = ''; }
  else {
    try { recog.start(); }
    catch { micStatus.textContent = 'could not start mic'; }
  }
});

// Generate QR + pay URL
const form         = document.getElementById('chargeForm');
const qrPanel      = document.getElementById('qrPanel');
const qrCanvasWrap = document.getElementById('qrCanvas');
const qrAmount     = document.getElementById('qrAmount');
const qrNote       = document.getElementById('qrNote');
const payUrlEl     = document.getElementById('payUrl');
const copyBtn      = document.getElementById('copyBtn');
const downloadBtn  = document.getElementById('downloadBtn');
const openBtn      = document.getElementById('openBtn');

function buildPayUrl(amount, note) {
  const base = location.href.replace(/\/[^\/]*$/, '/') + 'pay.html';
  const params = new URLSearchParams();
  params.set('a', amount);
  if (note) params.set('n', note);
  return base + '?' + params.toString();
}

let lastQrDataUrl = null;

function renderQrToCanvas(canvas, text, size) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  const margin = 2;
  const total = modules + margin * 2;
  const scale = Math.max(1, Math.floor(size / total));
  const pixel = total * scale;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = pixel * dpr;
  canvas.height = pixel * dpr;
  canvas.style.width  = pixel + 'px';
  canvas.style.height = pixel + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixel, pixel);
  ctx.fillStyle = '#0a0a0a';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
    }
  }
}

function composeNote(rawNote) {
  const trimmed = (rawNote || '').trim();
  if (!trimmed) return CAFE_TAG;
  // Avoid double-tagging if user already typed it
  if (new RegExp(CAFE_TAG, 'i').test(trimmed)) return trimmed;
  return `${trimmed} · ${CAFE_TAG}`;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (listening) stopListening();

  const amt = parseFloat(amountInput.value.trim());
  if (!amt || amt <= 0) { amountInput.focus(); return; }
  const amtStr = amt.toFixed(2);
  const note = composeNote(noteInput.value);

  const url = buildPayUrl(amtStr, note);
  qrAmount.textContent = '$' + amtStr;
  qrNote.textContent = note ? '“' + note + '”' : '';
  payUrlEl.textContent = url;
  openBtn.href = url;

  qrCanvasWrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  qrCanvasWrap.appendChild(canvas);
  renderQrToCanvas(canvas, url, 320);
  lastQrDataUrl = canvas.toDataURL('image/png');

  qrPanel.classList.remove('hidden');
  qrPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

copyBtn.addEventListener('click', async () => {
  const url = payUrlEl.textContent;
  try {
    await navigator.clipboard.writeText(url);
    copyBtn.textContent = 'Copied ✓';
    setTimeout(() => copyBtn.textContent = 'Copy link', 1500);
  } catch {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => copyBtn.textContent = 'Copy link', 1500);
  }
});

downloadBtn.addEventListener('click', () => {
  if (!lastQrDataUrl) return;
  const a = document.createElement('a');
  a.href = lastQrDataUrl;
  const amt = amountInput.value.trim().replace(/\./g, '_');
  a.download = `qr-pay-${amt}.png`;
  a.click();
});
