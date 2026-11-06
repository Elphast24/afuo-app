<script>
  import { onMount } from 'svelte';
  import { useNavigate } from 'svelte-navigator';
  import { ShieldCheck, Eye, EyeOff, LoaderCircle, LogIn } from 'lucide-svelte';
  import AuthShell from '../auth/AuthShell.svelte';
  import { adminLogin, session, authReady } from '../lib/auth.js';
  import { showToast } from '../lib/toast.js';

  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  let username = '';
  let password = '';
  let show = false;
  let error = '';
  let busy = false;

  // Already signed in as an administrator
  $: if ($authReady && $session?.role === 'ADMIN') navigate('/admin', { replace: true });

  async function submit() {
    error = '';
    if (!username.trim() || !password) {
      error = 'Enter your username and password.';
      return;
    }
    busy = true;
    try {
      const user = await adminLogin(username.trim(), password);
      showToast(`Welcome back, ${user.name || 'admin'}.`, 'success');
      navigate('/admin', { replace: true });
    } catch (e) {
      error = e.code === 'ADMIN_LOCKED'
        ? `Too many failed attempts. Try again in ${Math.ceil((e.details?.retryAfter ?? 900) / 60)} minutes.`
        : e.message;
      password = '';
    } finally {
      busy = false;
    }
  }
</script>

<AuthShell labelledby="admin-title">
  <span class="mark"><ShieldCheck size={28} aria-hidden="true" /></span>
  <h1 id="admin-title">Admin sign in</h1>
  <p class="lead">For AgriMatch administrators. Farmers and buyers sign in with their phone number instead.</p>

  {#if isDev}
    <p class="dev">Development credentials: <strong>admin</strong> / <strong>AgriMatch@Admin2026</strong></p>
  {/if}

  <form on:submit|preventDefault={submit} novalidate>
    <div class="field" class:invalid={error}>
      <label for="username">Username</label>
      <input id="username" type="text" bind:value={username} autocomplete="username" autocapitalize="none" spellcheck="false" disabled={busy} />
    </div>

    <div class="field" class:invalid={error}>
      <label for="password">Password</label>
      <div class="pw">
        {#if show}
          <input id="password" type="text" bind:value={password} autocomplete="current-password" disabled={busy} aria-describedby={error ? 'admin-err' : undefined} />
        {:else}
          <input id="password" type="password" bind:value={password} autocomplete="current-password" disabled={busy} aria-describedby={error ? 'admin-err' : undefined} />
        {/if}
        <button type="button" class="toggle" on:click={() => (show = !show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {#if show}<EyeOff size={18} aria-hidden="true" />{:else}<Eye size={18} aria-hidden="true" />{/if}
        </button>
      </div>
    </div>

    {#if error}<p class="field-error" id="admin-err" role="alert">{error}</p>{/if}

    <button type="submit" class="btn btn-dark btn-block" disabled={busy}>
      {#if busy}<span class="spin"><LoaderCircle size={18} aria-hidden="true" /></span> Signing in...{:else}<LogIn size={18} aria-hidden="true" /> Sign in{/if}
    </button>
  </form>
</AuthShell>

<style>
  .mark { display: inline-grid; place-items: center; width: 56px; height: 56px; margin-top: var(--space-2); border-radius: 50%; background: var(--color-green-900); color: #fff; }
  h1 { margin-top: var(--space-3); font-size: var(--text-xl); font-weight: 700; }
  .lead { max-width: 34ch; margin: var(--space-2) auto var(--space-6); font-size: var(--text-sm); color: var(--color-muted); }
  .dev { margin: 0 auto var(--space-4); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--color-amber-100); color: #6b4a00; font-size: var(--text-xs); }

  form { display: grid; gap: var(--space-4); text-align: left; }
  .pw { position: relative; }
  .pw input { padding-right: 52px; }
  .toggle { position: absolute; top: 2px; right: 2px; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-muted); cursor: pointer; }
  .toggle:hover { color: var(--color-ink); }

  .btn { min-height: 52px; }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
