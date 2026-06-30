// Merchant page: amount + note -> pay URL + QR

const SETTINGS_KEY = 'qrpay.settings.v1';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch { return {}; }
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Populate settings inputs
const venmoInput = document.getElementById('venmoHandle');
const jellyInput = document.getElementById('jellyHandle');
const stripeInput = document.getElementById('stripeLink');
const saveStatus = document.getElementById('saveStatus');

const DEFAULT_VENMO = 'iqram';
const s = loadSettings();
venmoInput.value = s.venmo || DEFAULT_VENMO;
jellyInput.value = s.jelly || '';
stripeInput.value = s.stripe || '';

document.getElementById('saveSettings').addEventListener('click', () => {
  saveSettings({
    venmo: venmoInput.value.trim().replace(/^@/, ''),
    jelly: jellyInput.value.trim().replace(/^@/, ''),
    stripe: stripeInput.value.trim(),
  });
  saveStatus.textContent = 'saved ✓';
  setTimeout(() => saveStatus.textContent = '', 1800);
});

document.getElementById('openSettings').addEventListener('click', (e) => {
  setTimeout(() => document.getElementById('settings').scrollIntoView({ behavior: 'smooth' }), 10);
});

// Amount formatting: keep digits + one dot
const amountInput = document.getElementById('amount');
amountInput.addEventListener('input', (e) => {
  let v = e.target.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  // limit to 2 decimal places
  if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
  e.target.value = v;
});

// Voice note via Web Speech API
const noteInput = document.getElementById('note');
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
    let interim = '';
    let final = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    noteInput.value = (baseText + final + interim).trim();
    if (final) baseText += final + ' ';
  };
  recog.onerror = (e) => {
    micStatus.textContent = 'mic error: ' + e.error;
    stopListening();
  };
  recog.onend = () => {
    if (listening) {
      // user didn't stop manually but recog ended naturally
      stopListening();
      micStatus.textContent = '';
    }
  };
}

function stopListening() {
  listening = false;
  micBtn.classList.remove('listening');
  try { recog && recog.stop(); } catch {}
}

micBtn.addEventListener('click', () => {
  if (!recog) return;
  if (listening) {
    stopListening();
    micStatus.textContent = '';
  } else {
    try {
      recog.start();
    } catch (e) {
      micStatus.textContent = 'could not start mic';
    }
  }
});

// Generate QR + pay URL
const form = document.getElementById('chargeForm');
const qrPanel = document.getElementById('qrPanel');
const qrCanvas = document.getElementById('qrCanvas');
const qrAmount = document.getElementById('qrAmount');
const qrNote = document.getElementById('qrNote');
const payUrlEl = document.getElementById('payUrl');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const openBtn = document.getElementById('openBtn');

function buildPayUrl(amount, note) {
  const base = location.href.replace(/\/[^\/]*$/, '/') + 'pay.html';
  const params = new URLSearchParams();
  params.set('a', amount);
  if (note) params.set('n', note);
  return base + '?' + params.toString();
}

let lastQrDataUrl = null;

// Paint a qrcode-generator QR onto a canvas at a given pixel size.
function renderQrToCanvas(canvas, text, size) {
  // typeNumber 0 = auto-pick smallest version; 'M' error correction.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  const margin = 2; // quiet zone in modules
  const total = modules + margin * 2;
  const scale = Math.max(1, Math.floor(size / total));
  const pixel = total * scale;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = pixel * dpr;
  canvas.height = pixel * dpr;
  canvas.style.width = pixel + 'px';
  canvas.style.height = pixel + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixel, pixel);
  ctx.fillStyle = '#0b0f0c';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (listening) stopListening();

  const amtRaw = amountInput.value.trim();
  const amt = parseFloat(amtRaw);
  if (!amt || amt <= 0) {
    amountInput.focus();
    return;
  }
  const amtStr = amt.toFixed(2);
  const note = noteInput.value.trim();

  const url = buildPayUrl(amtStr, note);
  qrAmount.textContent = '$' + amtStr;
  qrNote.textContent = note ? '“' + note + '”' : '';
  payUrlEl.textContent = url;
  openBtn.href = url;

  // Render QR to canvas using qrcode-generator
  qrCanvas.innerHTML = '';
  const canvas = document.createElement('canvas');
  qrCanvas.appendChild(canvas);
  renderQrToCanvas(canvas, url, 320);
  lastQrDataUrl = canvas.toDataURL('image/png');

  qrPanel.classList.remove('hidden');
  qrPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

copyBtn.addEventListener('click', async () => {
  const url = payUrlEl.textContent;
  try {
    await navigator.clipboard.writeText(url);
    copyBtn.textContent = 'copied ✓';
    setTimeout(() => copyBtn.textContent = 'copy link', 1500);
  } catch {
    copyBtn.textContent = 'copy failed';
    setTimeout(() => copyBtn.textContent = 'copy link', 1500);
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
