// Customer page: read query params, wire pay buttons

const SETTINGS_KEY = 'qrpay.settings.v1';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

const params = new URLSearchParams(location.search);
const amount = params.get('a') || '0.00';
const note = params.get('n') || '';

const amt = parseFloat(amount);
const amtStr = (isFinite(amt) ? amt : 0).toFixed(2);

document.getElementById('payAmount').textContent = '$' + amtStr;
const noteEl = document.getElementById('payNote');
if (note) noteEl.textContent = '“' + note + '”';

const settings = loadSettings();
const venmo = (settings.venmo || '').replace(/^@/, '');
const jelly = (settings.jelly || '').replace(/^@/, '');
const stripe = settings.stripe || '';

const merchantParts = [];
if (venmo) merchantParts.push('@' + venmo);
document.getElementById('payMerchant').textContent = merchantParts.length ? 'pay ' + merchantParts.join(' / ') : '';

// Venmo button
const venmoBtn = document.getElementById('venmoBtn');
const venmoSub = document.getElementById('venmoSub');
if (venmo) {
  // Universal link: opens app on mobile, web on desktop
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

// Jelly button — stubbed to jellyjelly.com profile + amount/note params
// (swap to real Jelly pay scheme when published)
const jellyBtn = document.getElementById('jellyBtn');
const jellySub = document.getElementById('jellySub');
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

// Stripe Payment Link
const stripeBtn = document.getElementById('stripeBtn');
if (stripe) {
  // Stripe Payment Links accept prefilled email etc, but not dynamic amounts.
  // We forward client_reference_id with the note for reconciliation.
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
