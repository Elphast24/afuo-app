<script>
  import { useNavigate } from 'svelte-navigator';
  import { get } from 'svelte/store';
  import { Sprout, ShoppingBasket, LoaderCircle, ArrowRight } from 'lucide-svelte';
  import AuthShell from '../auth/AuthShell.svelte';
  import { session, updateProfile, nextPath } from '../lib/auth.js';
  import { showToast } from '../lib/toast.js';
  import { CITIES } from '../lib/format.js';

  const navigate = useNavigate();

  let role = $session?.role === 'BUYER' ? 'BUYER' : 'FARMER';
  let name = $session?.name ?? '';
  let location = $session?.location ?? '';
  let errors = {};
  let saving = false;

  async function submit() {
    errors = {};
    if (name.trim().length < 2) errors.name = 'Enter your name (at least 2 characters).';
    if (Object.keys(errors).length) return;

    saving = true;
    try {
      await updateProfile({ name: name.trim(), role, location: location || undefined });
      showToast(`Akwaaba, ${name.trim().split(' ')[0]}! Your account is ready.`, 'success');
      const next = get(nextPath);
      nextPath.set('/dashboard');
      navigate(next && !next.startsWith('/onboarding') ? next : '/dashboard', { replace: true });
    } catch (e) {
      errors = { ...e.fieldErrors };
      if (!Object.keys(errors).length) errors.form = e.message;
    } finally {
      saving = false;
    }
  }
</script>

<AuthShell labelledby="onboarding-title">
  <h1 id="onboarding-title">Tell us about you</h1>
  <p class="lead">Two quick questions and you are set.</p>

  <form on:submit|preventDefault={submit} novalidate>
    <fieldset class="roles">
      <legend class="sr-only">I am a</legend>
      <label class="role" class:selected={role === 'FARMER'}>
        <input type="radio" name="role" value="FARMER" bind:group={role} />
        <span class="icon-chip"><Sprout size={22} aria-hidden="true" /></span>
        <strong>Farmer</strong>
        <small>I sell produce</small>
      </label>
      <label class="role" class:selected={role === 'BUYER'}>
        <input type="radio" name="role" value="BUYER" bind:group={role} />
        <span class="icon-chip"><ShoppingBasket size={22} aria-hidden="true" /></span>
        <strong>Buyer</strong>
        <small>I buy produce</small>
      </label>
    </fieldset>

    <div class="field" class:invalid={errors.name}>
      <label for="name">Your name</label>
      <input id="name" type="text" bind:value={name} autocomplete="name" placeholder="e.g. Kwame Mensah"
        aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'name-err' : undefined} />
      {#if errors.name}<span class="field-error" id="name-err">{errors.name}</span>{/if}
    </div>

    <div class="field">
      <label for="loc">Nearest market town <span class="muted">(optional)</span></label>
      <select id="loc" bind:value={location}>
        <option value="">Select a town</option>
        {#each CITIES as c}<option value={c}>{c}</option>{/each}
      </select>
    </div>

    {#if errors.form}<p class="field-error" role="alert">{errors.form}</p>{/if}

    <button type="submit" class="btn btn-primary btn-block" disabled={saving}>
      {#if saving}
        <span class="spin"><LoaderCircle size={18} aria-hidden="true" /></span> Saving...
      {:else}
        Continue <ArrowRight size={18} aria-hidden="true" />
      {/if}
    </button>
  </form>
</AuthShell>

<style>
  h1 { font-size: var(--text-xl); font-weight: 700; margin-top: var(--space-2); }
  .lead { margin: var(--space-2) 0 var(--space-6); font-size: var(--text-sm); color: var(--color-muted); }

  form { display: grid; gap: var(--space-4); text-align: left; }

  .roles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .role {
    position: relative;
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-2);
    border: 1.5px solid var(--color-line-strong);
    border-radius: var(--radius-md);
    text-align: center;
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
  }
  .role input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
  .role:focus-within { outline: 3px solid var(--color-orange-600); outline-offset: 2px; }
  .role.selected { border-color: var(--color-green-700); background: var(--color-green-50); box-shadow: 0 0 0 1px var(--color-green-700); }
  .role small { color: var(--color-muted); font-size: var(--text-xs); }
  .role .icon-chip { margin-bottom: var(--space-1); }

  .btn { min-height: 56px; font-size: var(--text-base); box-shadow: 0 8px 18px rgba(201, 80, 44, 0.28); }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
