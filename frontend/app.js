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
  iStep: document.getElementById('iStep'),
  cancelBtn: document.getElementById('cancelBtn'),
  confirmBtn: document.getElementById('confirmBtn'),
};

let walletPubkey = null;
let activeSession = null; // { verdict, wallet, confirmToken, totalCooldown }
let cooldownInterval = null;
let statusPollInterval = null;

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
    await signSafeTransaction(verdict);
    return;
  }

  showIntervention(verdict, wallet);
}

async function signSafeTransaction(verdict) {
  if (!window.solanaWeb3) {
    setStatus('Solana web3.js failed to load. Refresh the page.', 'error');
    return;
  }

  if (!walletPubkey) {
    await connectWallet();
    if (!walletPubkey) {
      setStatus('Wallet must be connected to sign.', 'error');
      return;
    }
  }

  setStatus(`✓ Safe transaction (score ${verdict.score}/100). Signing on devnet…`, 'success');

  try {
    const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = window.solanaWeb3;
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const fromPubkey = new PublicKey(walletPubkey);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: fromPubkey,
        lamports: Math.round(0.001 * LAMPORTS_PER_SOL),
      }),
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    const result = await window.solana.signAndSendTransaction(tx);
    const signature = typeof result === 'string' ? result : result.signature;

    els.status.classList.remove('hidden', 'error');
    els.status.classList.add('success');
    els.status.textContent = '✓ Transaction signed and broadcast. ';
    const link = document.createElement('a');
    link.href = `https://solscan.io/tx/${signature}?cluster=devnet`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View on Solscan';
    els.status.appendChild(link);
  } catch (err) {
    console.error(err);
    setStatus(`Signing failed: ${err.message ?? err}`, 'error');
  }
}

function showIntervention(verdict, wallet) {
  activeSession = {
    verdict,
    wallet,
    confirmToken: null,
    totalCooldown: verdict.cooldownSeconds,
  };

  els.iScore.textContent = String(verdict.score);
  els.iSummary.textContent = verdict.sim.rawNote;

  els.iFindings.innerHTML = '';
  for (const f of verdict.findings) {
    const li = document.createElement('li');
    li.className = f.level;
    const ptsBadge = typeof f.points === 'number' ? ` (+${f.points})` : '';
    li.textContent = `${f.message}${ptsBadge}`;
    els.iFindings.appendChild(li);
  }

  els.iAudio.src = `/voice/${verdict.sessionId}`;
  els.iAudio.load();
  els.iAudio.play().catch(() => {});

  setConfirmState('cooldown');
  startCooldownDisplay(verdict.cooldownSeconds);
  startServerStatusPoll(verdict.sessionId);

  els.intervention.classList.remove('hidden');
}

function setConfirmState(state) {
  // state: 'cooldown' | 'acknowledge' | 'confirm' | 'busy' | 'done'
  switch (state) {
    case 'cooldown':
      els.confirmBtn.disabled = true;
      els.confirmBtn.textContent = 'Wait for cooldown…';
      els.iStep.textContent = 'Step 1 of 2 — wait, then acknowledge';
      break;
    case 'acknowledge':
      els.confirmBtn.disabled = false;
      els.confirmBtn.textContent = 'I acknowledge the risk →';
      els.iStep.textContent = 'Step 1 of 2 — acknowledge';
      break;
    case 'confirm':
      els.confirmBtn.disabled = false;
      els.confirmBtn.textContent = 'Confirm and sign anyway';
      els.iStep.textContent = 'Step 2 of 2 — final confirmation';
      break;
    case 'busy':
      els.confirmBtn.disabled = true;
      els.confirmBtn.textContent = 'Working…';
      break;
    case 'done':
      els.confirmBtn.disabled = true;
      els.confirmBtn.textContent = 'Signed';
      els.iStep.textContent = '';
      break;
  }
}

function startCooldownDisplay(seconds) {
  if (cooldownInterval) clearInterval(cooldownInterval);
  const total = seconds;
  let remaining = seconds;
  els.iTimer.textContent = String(remaining);
  els.iBar.style.width = '100%';

  cooldownInterval = setInterval(() => {
    remaining -= 0.1;
    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
      els.iTimer.textContent = '0';
      els.iBar.style.width = '0%';
      // Final state is set by the server-status poll, but flip locally too in
      // case the poll hasn't landed yet.
      if (activeSession && !activeSession.confirmToken) setConfirmState('acknowledge');
      return;
    }
    els.iTimer.textContent = remaining.toFixed(1);
    els.iBar.style.width = `${(remaining / total) * 100}%`;
  }, 100);
}

function startServerStatusPoll(sessionId) {
  if (statusPollInterval) clearInterval(statusPollInterval);
  statusPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/cooldown/${sessionId}`);
      if (!res.ok) return;
      const status = await res.json();
      if (status.cooldownPassed && activeSession && !activeSession.confirmToken) {
        // Server confirms the timer is up — make sure the UI agrees.
        setConfirmState('acknowledge');
      }
    } catch {
      /* network blip — keep trying */
    }
  }, 1000);
}

function closeIntervention() {
  els.intervention.classList.add('hidden');
  if (cooldownInterval) clearInterval(cooldownInterval);
  if (statusPollInterval) clearInterval(statusPollInterval);
  cooldownInterval = null;
  statusPollInterval = null;
  els.iAudio.pause();
  els.iAudio.src = '';
  activeSession = null;
}

const ERROR_HINTS = {
  cooldown_active: 'Cooldown timer is still running.',
  wallet_mismatch: 'This session was opened by a different wallet.',
  not_acknowledged: 'You must acknowledge the risk before confirming.',
  invalid_token: 'Confirmation token is invalid — start over.',
  token_expired: 'Confirmation token expired (60s) — acknowledge again.',
  too_many_attempts: 'Too many attempts. Session is locked.',
  not_found: 'Session no longer exists.',
};

async function acknowledge() {
  if (!activeSession) return;
  setConfirmState('busy');
  try {
    const res = await fetch(
      `/cooldown/${activeSession.verdict.sessionId}/acknowledge`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: activeSession.wallet }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = ERROR_HINTS[body.error] ?? body.error ?? `HTTP ${res.status}`;
      setStatus(`Acknowledgement rejected: ${hint}`, 'error');
      setConfirmState('acknowledge');
      return;
    }
    activeSession.confirmToken = body.confirmToken;
    setConfirmState('confirm');
  } catch (err) {
    setStatus(`Network error: ${err.message}`, 'error');
    setConfirmState('acknowledge');
  }
}

async function confirmSign() {
  if (!activeSession?.confirmToken) return;
  setConfirmState('busy');
  try {
    const res = await fetch('/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSession.verdict.sessionId,
        wallet: activeSession.wallet,
        confirmToken: activeSession.confirmToken,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = ERROR_HINTS[body.error] ?? body.error ?? `HTTP ${res.status}`;
      setStatus(`Confirmation rejected: ${hint}`, 'error');
      // If token expired, drop back to acknowledge so user can re-ack.
      setConfirmState(body.error === 'token_expired' ? 'acknowledge' : 'confirm');
      if (body.error === 'token_expired') activeSession.confirmToken = null;
      return;
    }
    setConfirmState('done');
    setStatus('⚠ Transaction signed despite warnings. (mock)', 'error');
  } catch (err) {
    setStatus(`Network error: ${err.message}`, 'error');
    setConfirmState('confirm');
  } finally {
    if (els.confirmBtn.textContent === 'Signed') {
      setTimeout(closeIntervention, 1200);
    }
  }
}

function onConfirmClick() {
  if (!activeSession) return;
  if (!activeSession.confirmToken) {
    acknowledge();
  } else {
    confirmSign();
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
els.confirmBtn.addEventListener('click', onConfirmClick);
