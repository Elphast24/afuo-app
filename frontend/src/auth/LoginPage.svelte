<script>
  import { useNavigate } from 'svelte-navigator';
  import { X, Send, LoaderCircle } from 'lucide-svelte';
  import AuthShell from './AuthShell.svelte';
  import { sendOtp, pendingPhone, toNationalDigits, isValidNational, toE164, formatNational } from '../lib/auth.js';
  import { showToast } from '../lib/toast.js';

  const navigate = useNavigate();

  let national = '';
  let error = '';
  let sending = false;
  let input;

  $: display = formatNational(national);

  function onInput(e) {
    national = toNationalDigits(e.currentTarget.value);
    error = '';
    e.currentTarget.value = formatNational(national);
  }

  function clearField() {
    national = '';
    error = '';
    input.focus();
  }

  async function submit() {
    if (!isValidNational(national)) {
      error = 'Enter a valid Ghana mobile number, e.g. 241 234 567.';
      input.focus();
      return;
    }

    sending = true;
    const phone = toE164(national);
    try {
      await sendOtp(phone);
      pendingPhone.set(phone);
      showToast('Code sent. Check your messages.', 'success');
      navigate('/verify');
    } catch (e) {
      if (e.code === 'OTP_RATE_LIMITED' && (e.details?.retryAfter ?? 999) <= 60) {
        // A code was just sent; carry on to the verify step so they can enter it
        pendingPhone.set(phone);
        navigate('/verify');
      } else {
        error = e.message;
      }
    } finally {
      sending = false;
    }
  }
</script>

<AuthShell labelledby="login-title">
  <svg class="art" viewBox="0 0 160 120" role="img" aria-label="A phone handset and an envelope showing a masked code">
    <path d="M18 24c-8 8-6 22 6 40s30 34 44 40c10 4 18 0 22-6l-14-18-14 6c-8-4-22-18-26-28l8-12-12-24z" fill="var(--color-amber-200)" />
    <rect x="48" y="30" width="86" height="66" rx="12" fill="var(--color-amber-500)" />
    <path d="M52 36l39 30 39-30" fill="none" stroke="var(--color-amber-200)" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" />
    <rect x="88" y="24" width="52" height="16" rx="8" fill="#fff" />
    <text x="114" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="var(--color-muted)" letter-spacing="1">******</text>
  </svg>

  <h1 id="login-title">Enter phone number</h1>
  <p class="lead">We'll text you a 6-digit code to sign in or create your account.</p>

  <form on:submit|preventDefault={submit} novalidate>
    <label for="phone" class="sr-only">Phone number</label>
    <div class="phone" class:invalid={error}>
      <span class="prefix" aria-hidden="true">
        <span class="flag"></span>
        <span>+233</span>
      </span>
      <input
        bind:this={input}
        id="phone"
        type="text"
        inputmode="tel"
        autocomplete="tel-national"
        placeholder="241 234 567"
        value={display}
        on:input={onInput}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'phone-err' : 'phone-hint'}
        disabled={sending}
      />
      {#if national}
        <button type="button" class="clear" on:click={clearField} aria-label="Clear phone number" disabled={sending}>
          <X size={18} aria-hidden="true" />
        </button>
      {/if}
    </div>

    {#if error}
      <p class="msg error" id="phone-err" role="alert">{error}</p>
    {:else}
      <p class="msg" id="phone-hint">Ghana mobile numbers only. Standard SMS rates may apply.</p>
    {/if}

    <button type="submit" class="btn btn-primary btn-block" disabled={sending}>
      {#if sending}
        <span class="spin"><LoaderCircle size={18} aria-hidden="true" /></span> Sending...
      {:else}
        <Send size={18} aria-hidden="true" /> Send code
      {/if}
    </button>
  </form>
</AuthShell>

<style>
  .art {
    display: block;
    width: 150px;
    height: auto;
    margin: var(--space-2) auto var(--space-6);
  }

  h1 {
    font-size: var(--text-xl);
    font-weight: 700;
  }

  .lead {
    max-width: 32ch;
    margin: var(--space-2) auto var(--space-6);
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  form {
    text-align: left;
  }

  .phone {
    display: flex;
    align-items: center;
    min-height: 56px;
    padding: 0 var(--space-2) 0 var(--space-3);
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-pill);
    background: #fff;
    box-shadow: var(--shadow-sm);
    transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
  }

  .phone:focus-within {
    border-color: var(--color-green-700);
    box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.28);
  }

  .phone.invalid {
    border-color: var(--color-danger);
  }

  .prefix {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding-right: var(--space-3);
    margin-right: var(--space-3);
    border-right: 1px solid var(--color-line);
    font-weight: 600;
  }

  /* Ghana flag (red, gold, green with a black star), no external asset */
  .flag {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(to bottom, #ce1126 0 33.3%, #fcd116 33.3% 66.6%, #006b3f 66.6% 100%);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  }

  .flag::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 11px;
    height: 11px;
    background: #111;
    transform: translate(-50%, -52%);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  }

  .phone input {
    flex: 1;
    min-width: 0;
    min-height: 52px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    font-size: 1.0625rem;
    letter-spacing: 0.02em;
  }

  .phone input:focus-visible {
    box-shadow: none;
    border: 0;
  }

  .clear {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
  }

  .clear:hover {
    background: var(--color-bg);
    color: var(--color-ink);
  }

  .msg {
    margin: var(--space-2) var(--space-3) var(--space-6);
    font-size: var(--text-xs);
    color: var(--color-muted);
  }

  .msg.error {
    color: var(--color-danger);
    font-weight: 500;
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
