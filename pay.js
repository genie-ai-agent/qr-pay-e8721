// Customer page: read query params, wire pay buttons, handle tip

const SETTINGS_KEY = 'qrpay.settings.v1';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

const params = new URLSearchParams(location.search);
const amountParam = params.get('a') || '0.00';
const note = params.get('n') || '';

const subtotal = Math.max(0, parseFloat(amountParam) || 0);
let tipKind = '0';   // '0' | '0.15' | '0.20' | 'custom'
let tipCustom = 0;   // dollars

const DEFAULT_VENMO = 'iqram';
const settings = loadSettings();
const venmo  = (settings.venmo  || DEFAULT_VENMO).replace(/^@/, '');
const jelly  = (settings.jelly  || '').replace(/^@/, '');
const stripe = settings.stripe  || '';

// Static UI
const noteEl = document.getElementById('payNote');
if (note) noteEl.textContent = '“' + note + '”';
const merchantParts = [];
if (venmo) merchantParts.push('@' + venmo);
document.getElementById('payMerchant').textContent = merchantParts.length ? 'pay ' + merchantParts.join(' / ') : '';

const payAmountEl = document.getElementById('payAmount');
const payTotalLabel = document.getElementById('payTotalLabel');
const payBreakdown = document.getElementById('payBreakdown');
const tipRow = document.getElementById('tipRow');
const tipCustomRow = document.getElementById('tipCustomRow');
const tipCustomInput = document.getElementById('tipCustom');
const tip15Sub = document.getElementById('tip15Sub');
const tip20Sub = document.getElementById('tip20Sub');

const venmoBtn  = document.getElementById('venmoBtn');
const venmoSub  = document.getElementById('venmoSub');
const jellyBtn  = document.getElementById('jellyBtn');
const jellySub  = document.getElementById('jellySub');
const stripeBtn = document.getElementById('stripeBtn');

// Precompute tip preview labels (always shown against subtotal)
tip15Sub.textContent = '$' + (subtotal * 0.15).toFixed(2);
tip20Sub.textContent = '$' + (subtotal * 0.20).toFixed(2);

function currentTip() {
  if (tipKind === '0') return 0;
  if (tipKind === '0.15') return subtotal * 0.15;
  if (tipKind === '0.20') return subtotal * 0.20;
  if (tipKind === 'custom') return Math.max(0, tipCustom || 0);
  return 0;
}

function render() {
  const tip = currentTip();
  const total = subtotal + tip;

  // Replace the leading text node with the new total (keep the .total-suffix child intact)
  const first = payAmountEl.firstChild;
  if (first && first.nodeType === Node.TEXT_NODE) {
    first.nodeValue = '$' + total.toFixed(2);
  } else {
    payAmountEl.insertBefore(document.createTextNode('$' + total.toFixed(2)), payAmountEl.firstChild);
  }
  payTotalLabel.textContent = tip > 0 ? 'Total with tip' : 'Subtotal';

  if (tip > 0) {
    payBreakdown.innerHTML =
      `<span>Subtotal <b>$${subtotal.toFixed(2)}</b></span>` +
      `<span>Tip <b>$${tip.toFixed(2)}</b></span>`;
  } else {
    payBreakdown.innerHTML = '';
  }

  // Active tip button
  [...tipRow.querySelectorAll('.tip-btn')].forEach(b => {
    b.classList.toggle('active', b.dataset.tip === tipKind);
  });
  tipCustomRow.classList.toggle('show', tipKind === 'custom');

  // Update pay links with the new total
  const amtStr = total.toFixed(2);

  if (venmo) {
    const vurl = new URL('https://venmo.com/' + encodeURIComponent(venmo));
    vurl.searchParams.set('txn', 'pay');
    vurl.searchParams.set('amount', amtStr);
    if (note) vurl.searchParams.set('note', note);
    venmoBtn.href = vurl.toString();
    venmoSub.textContent = '@' + venmo;
  } else {
    venmoBtn.setAttribute('aria-disabled', 'true');
    venmoSub.textContent = 'set handle in merchant settings';
  }

  if (jelly) {
    const jurl = new URL('https://jellyjelly.com/' + encodeURIComponent(jelly));
    jurl.searchParams.set('action', 'pay');
    jurl.searchParams.set('amount', amtStr);
    if (note) jurl.searchParams.set('note', note);
    jellyBtn.href = jurl.toString();
    jellySub.textContent = '@' + jelly;
  } else {
    jellyBtn.setAttribute('aria-disabled', 'true');
    jellySub.textContent = 'set username in merchant settings';
  }

  if (stripe) {
    try {
      const surl = new URL(stripe);
      if (note) surl.searchParams.set('client_reference_id', note.slice(0, 200));
      stripeBtn.href = surl.toString();
    } catch {
      stripeBtn.href = stripe;
    }
  } else {
    stripeBtn.setAttribute('aria-disabled', 'true');
    stripeBtn.querySelector('.pay-btn-sub').textContent = 'paste a stripe link in settings';
  }
}

// Tip handlers
tipRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.tip-btn');
  if (!btn) return;
  tipKind = btn.dataset.tip;
  if (tipKind === 'custom') {
    setTimeout(() => tipCustomInput.focus(), 50);
  }
  render();
});

tipCustomInput.addEventListener('input', (e) => {
  let v = e.target.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
  e.target.value = v;
  tipCustom = parseFloat(v) || 0;
  tipKind = 'custom';
  render();
});

render();
