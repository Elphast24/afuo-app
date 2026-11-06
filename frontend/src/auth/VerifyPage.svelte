<script>
  import { onMount } from 'svelte';
  import { useNavigate, Link } from 'svelte-navigator';
  import { ShieldCheck, LoaderCircle } from 'lucide-svelte';
  import AuthShell from './AuthShell.svelte';
  import OtpInput from './OtpInput.svelte';
  import { pendingPhone, sendOtp, verifyOtp, formatNational, nextPath } from '../lib/auth.js';
  import { get } from 'svelte/store';
  import { showToast } from '../lib/toast.js';

  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  let phone = null;
  let code = '';
  let otp;
  let error = '';
  let verifying = false;
  let resending = false;
  let resendIn = 60;
  let expired = false;
  let locked = false;
  let timer;

  $: pretty = phone ? `+233 ${formatNational(phone.slice(4))}` : '';
  // Typing a fresh code dismisses the previous error
  $: if (code.length > 0) error = '';
  $: clock = `${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`;

  function startCooldown(seconds) {
    resendIn = seconds;
    clearInterval(timer);
    timer = setInterval(() => {
      resendIn = Math.max(0, resendIn - 1);
      if (resendIn === 0) clearInterval(timer);
    }, 1000);
  }

  onMount(() => {
    phone = $pendingPhone;
    if (!phone) {
      // Opened directly or after a refresh: there is no code to verify
      navigate('/login', { replace: true });
      return;
    }
    startCooldown(60);
    otp?.focus();
    return () => clearInterval(timer);
  });

  async function submit(entered = code) {
    if (verifying || locked) return;
    if (entered.length < 6) {
      error = 'Enter all 6 digits.';
      return;
    }

    verifying = true;
    error = '';
    try {
      const { user } = await verifyOtp(phone, entered);
      showToast('You are signed in.', 'success');
      // New accounts finish onboarding first; everyone else goes where they were headed
      navigate(user.name ? get(nextPath) : '/onboarding', { replace: true });
      nextPath.set('/dashboard');
    } catch (e) {
      error = e.message;
      expired = e.code === 'OTP_EXPIRED';
      locked = e.code === 'OTP_LOCKED';
      otp?.clear();
    } finally {
      verifying = false;
    }
  }

  async function resend() {
    if (resendIn > 0 || resending) return;
    resending = true;
    error = '';
    try {
      const res = await sendOtp(phone);
      expired = false;
      startCooldown(res.retryAfter);
      otp?.clear();
      showToast('New code sent.', 'info');
    } catch (e) {
      error = e.message;
      const wait = e.details?.retryAfter;
      if (wait && wait <= 60) startCooldown(wait);
    } finally {
      resending = false;
    }
  }
</script>

<AuthShell labelledby="verify-title">
  <svg class="art" viewBox="0 0 160 120" role="img" aria-label="A padlock with a key">
    <circle cx="86" cy="42" r="26" fill="none" stroke="var(--color-amber-200)" stroke-width="9" />
    <rect x="50" y="52" width="70" height="58" rx="12" fill="var(--color-amber-500)" />
    <circle cx="85" cy="78" r="7" fill="#fff" />
    <rect x="82" y="82" width="6" height="16" rx="3" fill="#fff" />
    <circle cx="128" cy="44" r="12" fill="var(--color-amber-200)" />
    <circle cx="128" cy="44" r="4" fill="#fff" />
    <rect x="124" y="54" width="8" height="34" rx="4" fill="var(--color-amber-200)" />
  </svg>

  <h1 id="verify-title">Enter OTP code</h1>
  <p class="lead">
    We sent a 6-digit code to <strong>{pretty}</strong>.
    <Link to="/login" class="change">Change number</Link>
  </p>

  {#if isDev}
    <p class="dev">Dev mode: the code is printed in the API server log.</p>
  {/if}

  <form on:submit|preventDefault={() => submit()} novalidate>
    <OtpInput
      bind:this={otp}
      bind:value={code}
      labelledby="verify-title"
      invalid={!!error}
      disabled={verifying || locked}
      on:complete={(e) => submit(e.detail)}
    />

    <p class="status" role="alert" class:error>{error}</p>

    <div class="resend">
      {#if resendIn > 0}
        <span class="wait">Resend code in {clock}</span>
      {:else}
        <button type="button" class="link" on:click={resend} disabled={resending || locked}>
          {resending ? 'Sending...' : 'Resend code'}
        </button>
      {/if}
    </div>

    <button type="submit" class="btn btn-primary btn-block" disabled={verifying || locked || expired}>
      {#if verifying}
        <span class="spin"><LoaderCircle size={18} aria-hidden="true" /></span> Verifying...
      {:else}
        <ShieldCheck size={18} aria-hidden="true" /> Verify code
      {/if}
    </button>
  </form>
</AuthShell>

<style>
  .art {
    display: block;
    width: 140px;
    height: auto;
    margin: var(--space-2) auto var(--space-4);
  }

  h1 {
    font-size: var(--text-xl);
    font-weight: 700;
  }

  .lead {
    max-width: 34ch;
    margin: var(--space-2) auto var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  .lead strong {
    color: var(--color-ink);
    white-space: nowrap;
  }

  .lead :global(.change) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-left: var(--space-1);
    color: var(--color-green-700);
    font-weight: 600;
    text-decoration: underline;
  }

  .dev {
    margin: 0 auto var(--space-4);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--color-amber-100);
    color: #6b4a00;
    font-size: var(--text-xs);
  }

  .status {
    min-height: 1.5rem;
    margin: var(--space-3) 0 var(--space-1);
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  .status.error {
    color: var(--color-danger);
    font-weight: 500;
  }

  .resend {
    margin-bottom: var(--space-4);
  }

  .wait {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  .link {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 0;
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .link:hover:not(:disabled) {
    color: var(--color-orange-700);
  }

  .link:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn {
    min-height: 56px;
    font-size: var(--text-base);
    box-shadow: 0 8px 18px rgba(201, 80, 44, 0.28);
  }

  .spin {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
