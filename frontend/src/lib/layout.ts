<script>
import { onMount } from 'svelte';
import { page } from '$app/state';

let activeTab = 'farmer';
let totalListings = 0;
let totalProduce = 0;
let totalLocations = 0;

function switchTab(tab) {
  activeTab = tab;
  // Store in localStorage for persistence
  localStorage.setItem('activeTab', tab);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2700);
}

onMount(() => {
  // Restore active tab from localStorage
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) activeTab = savedTab;
  
  // Simulate real-time updates
  const interval = setInterval(() => {
    totalListings = Math.floor(Math.random() * 1000);
    totalProduce = Math.floor(Math.random() * 150);
    totalLocations = Math.floor(Math.random() * 50);
  }, 5000);
  
  return () => clearInterval(interval);
});
</script>

<div class="header">
  <div class="header-content">
    <div class="logo">
      <span class="logo-icon">🌾</span>
      <div>
        <h1>AgriMatch</h1>
        <p>Agricultural Produce Market System</p>
      </div>
    </div>
    <div class="header-stats">
      <div class="header-stat">
        <span class="number">{totalListings}</span>
        <span class="label">Listings</span>
      </div>
      <div class="header-stat">
        <span class="number">{totalProduce}</span>
        <span class="label">Produce Types</span>
      </div>
      <div class="header-stat">
        <span class="number">{totalLocations}</span>
        <span class="label">Locations</span>
      </div>
    </div>
  </div>
</div>

<nav class="nav-tabs">
  <button 
    class="nav-tab {activeTab === 'farmer' ? 'active' : ''}" 
    on:click={() => switchTab('farmer')}
  >
    <span class="tab-icon">🧑‍🌾</span> Farmer
  </button>
  <button 
    class="nav-tab {activeTab === 'buyer' ? 'active' : ''}" 
    on:click={() => switchTab('buyer')}
  >
    <span class="tab-icon">🛒</span> Buyer
  </button>
  <button 
    class="nav-tab {activeTab === 'market' ? 'active' : ''}" 
    on:click={() => switchTab('market')}
  >
    <span class="tab-icon">📊</span> Market Overview
  </button>
</nav>

<main class="main-content">
  <div class="tab-content {activeTab === 'farmer' ? 'active' : ''}" id="tab-farmer">
    <slot name="farmer" />
  </div>
  
  <div class="tab-content {activeTab === 'buyer' ? 'active' : ''}" id="tab-buyer">
    <slot name="buyer" />
  </div>
  
  <div class="tab-content {activeTab === 'market' ? 'active' : ''}" id="tab-market">
    <slot name="market" />
  </div>
</main>

<style>
.header {
  background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 50%, var(--primary-light) 100%);
  color: var(--text-white);
  padding: 1.5rem 2rem;
  box-shadow: var(--shadow-lg);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  font-size: 2.2rem;
}

.logo h1 {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
}

.logo p {
  font-size: 0.8rem;
  opacity: 0.85;
  margin-top: -2px;
}

.header-stats {
  display: flex;
  gap: 1.5rem;
}

.header-stat {
  text-align: center;
  background: rgba(255,255,255,0.15);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(10px);
}

.header-stat .number {
  font-size: 1.4rem;
  font-weight: 700;
  display: block;
}

.header-stat .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.85;
}

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.nav-tab {
  padding: 0.75rem 2rem;
  border: 2px solid var(--border);
  background: transparent;
  border-radius: 50px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-light);
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-tab:hover {
  border-color: var(--primary-light);
  color: var(--primary);
  background: rgba(45, 106, 79, 0.05);
}

.nav-tab.active {
  background: var(--primary);
  color: var(--text-white);
  border-color: var(--primary);
  box-shadow: 0 4px 15px rgba(45, 106, 79, 0.3);
}

.tab-icon {
  font-size: 1.2rem;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.tab-content {
  display: none;
  animation: fadeIn 0.4s ease;
}

.tab-content.active {
  display: block;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .header-content {
    justify-content: center;
    text-align: center;
  }

  .header-stats {
    justify-content: center;
  }

  .main-content {
    padding: 1rem;
  }

  .nav-tab {
    padding: 0.6rem 1.2rem;
    font-size: 0.85rem;
  }
}
</style>

<script>
// Expose showToast to global scope for use in other components
window.showToast = showToast;
</script>