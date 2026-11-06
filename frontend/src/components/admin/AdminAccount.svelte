<script>
  import { useNavigate } from 'svelte-navigator';
  import { KeyRound, LogOut, LoaderCircle, Check } from 'lucide-svelte';
  import { api } from '../../lib/api.js';
  import { session, signOut } from '../../lib/auth.js';
  import { showToast } from '../../lib/toast.js';

  const navigate = useNavigate();

  let current = '';
  let next = '';
  let confirm = '';
  let errors = {};
  let busy = false;

  $: rules = [
    ['At least 12 characters', next.length >= 12],
    ['An upper case letter', /[A-Z]/.test(next)],
    ['A lower case letter', /[a-z]/.test(next)],
    ['A number', /\d/.test(next)]
  ];

  async function submit() {
    errors = {};
    if (!current) errors.currentPassword = 'Enter your current password.';
    if (!rules.every(([, ok]) => ok)) errors.newPassword = 'The new password does not meet the rules below.';
    if (next !== confirm) errors.confirm = 'The two new passwords do not match.';
    if (Object.keys(errors).length) return;

    busy = true;
    try {
      await api.admin.changePassword(current, next);
      current = next = confirm = '';
      showToast('Password changed. Other sessions were signed out.', 'success');
    } catch (e) {
      errors = { ...e.fieldErrors };
      if (e.code === 'INVALID_CREDENTIALS') errors.currentPassword = e.message;
      else if (!Object.keys(errors).length) errors.form = e.message;
    } finally {
      busy = false;
    }
  }

  async function logout() {
    await signOut();
    showToast('You are signed out.', 'info');
    navigate('/admin/login', { replace: true });
  }
</script>

<div class="grid">
  <section class="card" aria-labelledby="pw-title">
    <div class="card-header"><span class="icon-chip"><KeyRound size={20} aria-hidden="true" /></span><h2 id="pw-title">Change password</h2></div>
    <p class="muted who">Signed in as <strong>{$session.username || $session.name}</strong>.</p>

    <form on:submit|preventDefault={submit} novalidate class="stack">
      <div class="field" class:invalid={errors.currentPassword}>
        <label for="cur">Current password</label>
        <input id="cur" type="password" bind:value={current} autocomplete="current-password" aria-invalid={errors.currentPassword ? 'true' : undefined} />
        {#if errors.currentPassword}<span class="field-error">{errors.currentPassword}</span>{/if}
      </div>
      <div class="field" class:invalid={errors.newPassword}>
        <label for="new">New password</label>
        <input id="new" type="password" bind:value={next} autocomplete="new-password" aria-describedby="rules" aria-invalid={errors.newPassword ? 'true' : undefined} />
        {#if errors.newPassword}<span class="field-error">{errors.newPassword}</span>{/if}
        <ul id="rules" class="rules">
          {#each rules as [label, ok]}<li class:ok><Check size={14} aria-hidden="true" /> {label}</li>{/each}
        </ul>
      </div>
      <div class="field" class:invalid={errors.confirm}>
        <label for="conf">Confirm new password</label>
        <input id="conf" type="password" bind:value={confirm} autocomplete="new-password" aria-invalid={errors.confirm ? 'true' : undefined} />
        {#if errors.confirm}<span class="field-error">{errors.confirm}</span>{/if}
      </div>
      {#if errors.form}<p class="field-error" role="alert">{errors.form}</p>{/if}
      <div><button type="submit" class="btn btn-primary" disabled={busy}>{#if busy}<span class="spin"><LoaderCircle size={16} aria-hidden="true" /></span> Saving...{:else}Change password{/if}</button></div>
    </form>
  </section>

  <section class="card" aria-labelledby="out-title">
    <div class="card-header"><h2 id="out-title">Session</h2></div>
    <p class="muted">Changing your password signs out every other admin session.</p>
    <div class="out"><button type="button" class="btn btn-danger" on:click={logout}><LogOut size={16} aria-hidden="true" /> Sign out</button></div>
  </section>
</div>

<style>
  .grid { display: grid; gap: var(--space-6); align-items: start; }
  @media (min-width: 900px) { .grid { grid-template-columns: 3fr 2fr; } }
  .who { margin: calc(var(--space-3) * -1) 0 var(--space-4); font-size: var(--text-sm); }
  .rules { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); margin: var(--space-1) 0 0; padding: 0; list-style: none; font-size: var(--text-xs); color: var(--color-muted); }
  .rules li { display: inline-flex; align-items: center; gap: var(--space-1); }
  .rules li :global(svg) { opacity: 0.35; }
  .rules li.ok { color: var(--color-success); font-weight: 600; }
  .rules li.ok :global(svg) { opacity: 1; }
  .out { margin-top: var(--space-4); }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
