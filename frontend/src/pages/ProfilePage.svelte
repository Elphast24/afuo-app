<script>
  import { onMount } from 'svelte';
  import { useNavigate } from 'svelte-navigator';
  import { Save, LogOut, Star, LoaderCircle } from 'lucide-svelte';
  import PageLayout from '../components/PageLayout.svelte';
  import { session, updateProfile, signOut } from '../lib/auth.js';
  import { api } from '../lib/api.js';
  import { showToast } from '../lib/toast.js';
  import { CITIES, formatDate, initials } from '../lib/format.js';
  import { formatNational } from '../lib/auth.js';

  const navigate = useNavigate();

  let name = $session.name ?? '';
  let role = $session.role === 'BUYER' ? 'BUYER' : 'FARMER';
  let location = $session.location ?? '';
  let errors = {};
  let saving = false;
  let rating = null;

  $: phone = $session.phone ? `+233 ${formatNational($session.phone.slice(4))}` : '';
  $: dirty = name.trim() !== ($session.name ?? '') || role !== $session.role || location !== ($session.location ?? '');

  onMount(async () => {
    try {
      rating = await api.reviews.forUser($session.id);
    } catch {
      /* ratings are optional */
    }
  });

  async function save() {
    errors = {};
    if (name.trim().length < 2) {
      errors.name = 'Enter your name (at least 2 characters).';
      return;
    }
    saving = true;
    try {
      await updateProfile({ name: name.trim(), role, ...(location ? { location } : {}) });
      showToast('Profile saved.', 'success');
    } catch (e) {
      errors = { ...e.fieldErrors };
      if (!Object.keys(errors).length) showToast(e.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function logout() {
    await signOut();
    showToast('You are signed out.', 'info');
    navigate('/', { replace: true });
  }
</script>

<PageLayout current="profile" kicker="Account" title="Your profile" lead="Keep your details current so buyers and farmers know who they are dealing with.">
  <div class="grid">
    <section class="card" aria-labelledby="details-title">
      <div class="who">
        <span class="avatar" aria-hidden="true">{initials($session.name)}</span>
        <div>
          <h2 id="details-title">{$session.name || 'Your details'}</h2>
          <p class="muted">{phone} · joined {formatDate($session.createdAt)}</p>
        </div>
      </div>

      <form on:submit|preventDefault={save} novalidate class="stack">
        <div class="field" class:invalid={errors.name}>
          <label for="name">Name</label>
          <input id="name" type="text" bind:value={name} autocomplete="name"
            aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'name-err' : undefined} />
          {#if errors.name}<span class="field-error" id="name-err">{errors.name}</span>{/if}
        </div>

        <div class="field">
          <label for="role">I am a</label>
          <select id="role" bind:value={role}>
            <option value="FARMER">Farmer (sell produce)</option>
            <option value="BUYER">Buyer (buy produce)</option>
          </select>
        </div>

        <div class="field">
          <label for="loc">Nearest market town</label>
          <select id="loc" bind:value={location}>
            <option value="">Not set</option>
            {#each CITIES as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>

        <div class="actions">
          <button type="submit" class="btn btn-primary" disabled={saving || !dirty}>
            {#if saving}<span class="spin"><LoaderCircle size={16} aria-hidden="true" /></span> Saving...{:else}<Save size={16} aria-hidden="true" /> Save changes{/if}
          </button>
        </div>
      </form>
    </section>

    <div class="stack">
      <section class="card" aria-labelledby="rating-title">
        <div class="card-header">
          <span class="icon-chip"><Star size={20} aria-hidden="true" /></span>
          <h2 id="rating-title">Your rating</h2>
        </div>
        {#if !rating}
          <span class="skeleton sk"></span>
        {:else if rating.count === 0}
          <p class="muted">No reviews yet. Ratings appear after you trade with someone you messaged.</p>
        {:else}
          <p class="score"><strong>{rating.averageRating.toFixed(1)}</strong> / 5 <span class="muted">from {rating.count} {rating.count === 1 ? 'review' : 'reviews'}</span></p>
          <ul class="reviews">
            {#each rating.reviews.slice(0, 5) as r (r.id)}
              <li><span class="stars" aria-label="{r.rating} out of 5">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span>{r.comment || 'No comment'}</span> <span class="muted">· {r.reviewer.name || 'AgriMatch user'}</span></li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card" aria-labelledby="signout-title">
        <div class="card-header"><h2 id="signout-title">Session</h2></div>
        <button type="button" class="btn btn-danger" on:click={logout}><LogOut size={16} aria-hidden="true" /> Sign out</button>
      </section>
    </div>
  </div>
</PageLayout>

<style>
  .grid { display: grid; gap: var(--space-6); align-items: start; }
  @media (min-width: 900px) { .grid { grid-template-columns: 3fr 2fr; } }

  .who { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-6); }
  .avatar {
    display: grid; place-items: center; flex: none; width: 56px; height: 56px; border-radius: 50%;
    background: var(--color-green-900); color: #fff; font-weight: 600;
  }
  .who h2 { font-size: var(--text-xl); }
  .who p { font-size: var(--text-sm); }

  .actions { display: flex; gap: var(--space-3); }
  .spin { display: inline-flex; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .score { font-size: var(--text-lg); }
  .score strong { font-size: 1.75rem; }
  .reviews { display: grid; gap: var(--space-3); margin: var(--space-4) 0 0; padding: 0; list-style: none; font-size: var(--text-sm); }
  .stars { color: var(--series-3); letter-spacing: 2px; margin-right: var(--space-2); }
  .sk { height: 48px; }
</style>
