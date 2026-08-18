document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('order-pad-form');
const statusEl = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');
const btnLabel = submitBtn.querySelector('.btn-label');
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const eventFields = document.querySelector('.event-only');
const messageLabel = document.getElementById('message-label');

const MESSAGE_LABELS = {
  text_club: 'Anything else we should know?',
  event: 'Tell us about the event',
  question: 'Your question',
};

form.querySelectorAll('input[name="leadType"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const isEvent = radio.value === 'event' && radio.checked;
    if (radio.checked) {
      eventFields.hidden = radio.value !== 'event';
      messageLabel.textContent = MESSAGE_LABELS[radio.value] || MESSAGE_LABELS.text_club;
    }
  });
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnSpinner.hidden = !isLoading;
  btnLabel.textContent = isLoading ? 'Sending…' : 'Ring It In';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = '';
  statusEl.className = 'form-status';

  const fd = new FormData(form);
  const payload = {
    leadType: fd.get('leadType'),
    name: fd.get('name'),
    phone: fd.get('phone'),
    email: fd.get('email'),
    partySize: fd.get('partySize') || null,
    preferredDate: fd.get('preferredDate') || null,
    message: fd.get('message'),
    website: fd.get('website'), // honeypot
    sourcePage: window.location.pathname,
  };

  if (!payload.name || payload.name.trim().length < 2) {
    statusEl.textContent = 'Please enter your name.';
    statusEl.classList.add('error');
    return;
  }
  if (!payload.phone && !payload.email) {
    statusEl.textContent = 'Add a phone number or email so we can reach you.';
    statusEl.classList.add('error');
    return;
  }

  setLoading(true);
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }

    statusEl.textContent = `✔ Ticket #${data.id} punched in — we'll be in touch soon. Thanks!`;
    statusEl.classList.add('success');
    form.reset();
    eventFields.hidden = true;
    messageLabel.textContent = MESSAGE_LABELS.text_club;
  } catch (err) {
    statusEl.textContent = err.message || 'Something went wrong. Please call us at (317) 737-1161.';
    statusEl.classList.add('error');
  } finally {
    setLoading(false);
  }
});
