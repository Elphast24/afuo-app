<script>
  import { useNavigate, useLocation } from 'svelte-navigator';
  import { session, authReady, nextPath } from '../lib/auth.js';
  import { showToast } from '../lib/toast.js';

  /** Limit the page to these roles (e.g. ['FARMER']). ADMIN always passes. */
  export let roles = null;
  /** The onboarding page is for signed-in users who have not set a name yet */
  export let allowUnnamed = false;
  /** Where signed-out visitors go, and where signed-in users with the wrong role go */
  export let loginPath = '/login';
  export let denyPath = '/dashboard';

  const navigate = useNavigate();
  const location = useLocation();

  $: user = $session;
  $: roleOk = !roles || (user && (user.role === 'ADMIN' || roles.includes(user.role)));
  $: allowed = $authReady && !!user && (allowUnnamed || !!user.name) && roleOk;

  $: if ($authReady) {
    if (!user) {
      nextPath.set($location.pathname + $location.search);
      navigate(loginPath, { replace: true });
    } else if (!allowUnnamed && !user.name) {
      nextPath.set($location.pathname + $location.search);
      navigate('/onboarding', { replace: true });
    } else if (!roleOk) {
      showToast(`That page is for ${roles.map((r) => r.toLowerCase()).join(' / ')} accounts.`, 'info');
      navigate(denyPath, { replace: true });
    }
  }
</script>

{#if allowed}
  <slot />
{:else}
  <div class="loading" role="status" aria-live="polite">
    <span class="sr-only">Loading</span>
    <span class="skeleton bar"></span>
    <span class="skeleton bar short"></span>
  </div>
{/if}

<style>
  .loading {
    display: grid;
    align-content: center;
    gap: var(--space-3);
    min-height: 100dvh;
    padding: var(--space-8) var(--gutter);
    max-width: 640px;
    margin: 0 auto;
  }
  .bar {
    height: 24px;
  }
  .short {
    width: 60%;
  }
</style>
