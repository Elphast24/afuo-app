<script>
import { onMount } from 'svelte';
import { Router, Route } from 'svelte-navigator';
import { WifiOff } from 'lucide-svelte';
import LandingPage from './LandingPage.svelte';
import Guard from './components/Guard.svelte';
import Redirect from './components/Redirect.svelte';
import OnboardingPage from './pages/OnboardingPage.svelte';
import DashboardPage from './pages/DashboardPage.svelte';
import MyListingsPage from './pages/MyListingsPage.svelte';
import ListingFormPage from './pages/ListingFormPage.svelte';
import ListingDetailPage from './pages/ListingDetailPage.svelte';
import SearchPage from './pages/SearchPage.svelte';
import MarketPage from './pages/MarketPage.svelte';
import MessagesPage from './pages/MessagesPage.svelte';
import ProfilePage from './pages/ProfilePage.svelte';
import MarketplacePage from './pages/MarketplacePage.svelte';
import AdminLoginPage from './pages/AdminLoginPage.svelte';
import AdminPage from './pages/AdminPage.svelte';
import CreditsPage from './pages/CreditsPage.svelte';
import { initSession } from './lib/auth.js';
import './lib/socket.js';
import LoginPage from './auth/LoginPage.svelte';
import VerifyPage from './auth/VerifyPage.svelte';
import { toasts } from './lib/toast.js';

let isOffline = !navigator.onLine;

function handleOnlineStatus() {
  isOffline = false;
}

function handleOfflineStatus() {
  isOffline = true;
}

// Service worker registration for offline functionality
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service worker registered:', registration);
      })
      .catch(error => {
        console.error('Service worker registration failed:', error);
      });
  }
}

// Check for app updates
function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.update();
    });
  }
}

onMount(() => {
  initSession();

  // Register service worker for offline support
  registerServiceWorker();

  // Monitor online/offline status
  window.addEventListener('online', handleOnlineStatus);
  window.addEventListener('offline', handleOfflineStatus);

  // Check for updates periodically
  const interval = setInterval(checkForUpdates, 60000 * 30);

  return () => {
    window.removeEventListener('online', handleOnlineStatus);
    window.removeEventListener('offline', handleOfflineStatus);
    clearInterval(interval);
  };
});

function getBasePath() {
  return window.location.pathname.includes('/agrimatch') ? '/agrimatch' : '/';
}
</script>

{#if isOffline}
  <div class="offline-banner" role="status">
    <WifiOff size={16} strokeWidth={2} aria-hidden="true" />
    <span>You're offline. Some features may not be available.</span>
  </div>
{/if}

<Router base={getBasePath()}>
  <Route path="/" component={LandingPage} />
  <Route path="/login" component={LoginPage} />
  <Route path="/verify" component={VerifyPage} />

  <Route path="/onboarding"><Guard allowUnnamed><OnboardingPage /></Guard></Route>
  <Route path="/dashboard"><Guard><DashboardPage /></Guard></Route>

  <Route path="/listings"><Guard roles={['FARMER']}><MyListingsPage /></Guard></Route>
  <Route path="/listings/new"><Guard roles={['FARMER']}><ListingFormPage /></Guard></Route>
  <Route path="/listings/:id/edit"><Guard roles={['FARMER']}><ListingFormPage editing /></Guard></Route>
  <Route path="/listings/:id"><Guard><ListingDetailPage /></Guard></Route>

  <Route path="/marketplace"><Guard><MarketplacePage /></Guard></Route>
  <Route path="/search"><Guard roles={['BUYER']}><SearchPage /></Guard></Route>
  <Route path="/market"><Guard><MarketPage /></Guard></Route>
  <Route path="/messages"><Guard><MessagesPage /></Guard></Route>
  <Route path="/messages/:conversationId"><Guard><MessagesPage /></Guard></Route>
  <Route path="/profile"><Guard><ProfilePage /></Guard></Route>

  <Route path="/admin/login" component={AdminLoginPage} />
  <Route path="/admin"><Guard roles={['ADMIN']} loginPath="/admin/login" denyPath="/admin/login"><AdminPage /></Guard></Route>
  <Route path="/credits" component={CreditsPage} />

  <!-- old paths -->
  <Route path="/farmer"><Redirect to="/listings" /></Route>
  <Route path="/buyer"><Redirect to="/search" /></Route>
</Router>

<div class="toast-container" role="status" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}">{toast.message}</div>
  {/each}
</div>

<style>
  .offline-banner {
    position: sticky;
    top: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-orange-700);
    color: #fff;
    font-size: var(--text-sm);
    font-weight: 500;
    text-align: center;
    animation: slide-down var(--dur-base) var(--ease-out);
  }

  .toast-container {
    position: fixed;
    inset: auto var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom)) var(--space-4);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    pointer-events: none;
  }

  .toast {
    max-width: 420px;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--color-green-900);
    color: #fff;
    box-shadow: var(--shadow-md);
    font-size: var(--text-sm);
    font-weight: 500;
    animation: toast-in var(--dur-base) var(--ease-out);
  }

  .toast-error {
    background: var(--color-danger);
  }

  .toast-info {
    background: var(--color-ink);
  }

  @keyframes toast-in {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @keyframes slide-down {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }

  @media (min-width: 720px) {
    .toast-container {
      inset: auto var(--space-6) var(--space-6) auto;
      align-items: flex-end;
    }
  }
</style>
