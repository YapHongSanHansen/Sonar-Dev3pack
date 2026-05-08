const els = {
  connectBtn: document.getElementById('connectBtn'),
  scenarios: document.querySelectorAll('.scenario'),
  status: document.getElementById('status'),
  intervention: document.getElementById('intervention'),
  iScore: document.getElementById('iScore'),
  iSummary: document.getElementById('iSummary'),
  iFindings: document.getElementById('iFindings'),
  iAudio: document.getElementById('iAudio'),
  iTimer: document.getElementById('iTimer'),
  iBar: document.getElementById('iBar'),
  cancelBtn: document.getElementById('cancelBtn'),
  confirmBtn: document.getElementById('confirmBtn'),
};

let walletPubkey = null;
let activeSession = null;
let cooldownTimer = null;

function setStatus(message, kind = '') {
  els.status.classList.remove('hidden', 'success', 'error');
  if (kind) els.status.classList.add(kind);
  els.status.textContent = message;
}

function clearStatus() {
  els.status.classList.add('hidden');
  els.status.textContent = '';
}

async function connectWallet() {
  if (!window.solana?.isPhantom) {
    if (confirm('Phantom wallet not detected. Open the install page?')) {
      window.open('https://phantom.app/', '_blank');
    }
    return;
  }
  try {
    const resp = await window.solana.connect();
    walletPubkey = resp.publicKey.toString();
    els.connectBtn.textContent = `${walletPubkey.slice(0, 4)}…${walletPubkey.slice(-4)}`;
    els.connectBtn.classList.add('connected');
  } catch (err) {
    console.error(err);
    setStatus(`Wallet connection failed: ${err.message}`, 'error');
  }
}

function buildMockTransaction(scenario) {
  const payload = { scenario, t: Date.now(), nonce: Math.random().toString(36).slice(2) };
  return btoa(JSON.stringify(payload));
}

async function runScenario(scenario) {
  clearStatus();
  const wallet = walletPubkey ?? '11111111111111111111111111111111';

  let verdict;
  try {
    const res = await fetch('/risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wallet,
        transaction: buildMockTransaction(scenario),
        type: 'signTransaction',
        scenario,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    verdict = await res.json();
  } catch (err) {
    setStatus(`Risk engine error: ${err.message}`, 'error');
    return;
  }

  if (!verdict.riskRequired) {
    setStatus(`✓ Safe transaction (score ${verdict.score}/100). Signed.`, 'success');
    return;
  }

  showIntervention(verdict);
}

function showIntervention(verdict) {
  activeSession = verdict;

  els.iScore.textContent = String(verdict.score);
  els.iSummary.textContent = verdict.sim.rawNote;

  els.iFindings.innerHTML = '';
  for (const f of verdict.findings) {
    const li = document.createElement('li');
    li.className = f.level;
    li.textContent = f.message;
    els.iFindings.appendChild(li);
  }

  els.iAudio.src = `/voice/${verdict.sessionId}`;
  els.iAudio.load();
  els.iAudio.play().catch(() => {});

  els.confirmBtn.disabled = true;
  startCooldown(verdict.cooldownSeconds);

  els.intervention.classList.remove('hidden');
}

function startCooldown(seconds) {
  if (cooldownTimer) clearInterval(cooldownTimer);
  const total = seconds;
  let remaining = seconds;
  els.iTimer.textContent = String(remaining);
  els.iBar.style.width = '100%';

  cooldownTimer = setInterval(() => {
    remaining -= 0.1;
    if (remaining <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      els.iTimer.textContent = '0';
      els.iBar.style.width = '0%';
      els.confirmBtn.disabled = false;
      return;
    }
    els.iTimer.textContent = remaining.toFixed(1);
    els.iBar.style.width = `${(remaining / total) * 100}%`;
  }, 100);
}

function closeIntervention() {
  els.intervention.classList.add('hidden');
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = null;
  els.iAudio.pause();
  els.iAudio.src = '';
  activeSession = null;
}

async function confirmSign() {
  if (!activeSession) return;
  try {
    const res = await fetch('/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: activeSession.sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
    }
    setStatus('⚠ Transaction signed despite warnings. (mock)', 'error');
  } catch (err) {
    setStatus(`Confirmation rejected: ${err.message}`, 'error');
  } finally {
    closeIntervention();
  }
}

function cancelSign() {
  setStatus('✓ Transaction aborted. SONAR did its job.', 'success');
  closeIntervention();
}

els.connectBtn.addEventListener('click', connectWallet);
els.scenarios.forEach((b) =>
  b.addEventListener('click', () => runScenario(b.dataset.scenario)),
);
els.cancelBtn.addEventListener('click', cancelSign);
els.confirmBtn.addEventListener('click', confirmSign);
