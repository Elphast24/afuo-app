<script>
import { createSignal } from 'svelte';

const sampleOffers = [
  {
    id: 1,
    seller: 'John Kamau',
    produceType: 'Tomatoes',
    quantity: 500,
    unit: 'kg',
    pricePerUnit: 50,
    location: 'Nairobi',
    isOrganic: true,
    availableFrom: '2026-11-08',
    availableTo: '2026-11-22'
  },
  {
    id: 2,
    seller: 'Mary Wanjiru',
    produceType: 'Bananas',
    quantity: 200,
    unit: 'bunches',
    pricePerUnit: 30,
    location: 'Kisumu',
    isOrganic: false,
    availableFrom: '2026-11-10',
    availableTo: '2026-11-30'
  },
  {
    id: 3,
    seller: 'James Kariuki',
    produceType: 'Maize',
    quantity: 1000,
    unit: 'kg',
    pricePerUnit: 25,
    location: 'Nakuru',
    isOrganic: true,
    availableFrom: '2026-11-05',
    availableTo: '2026-12-05'
  }
];

const [searchData, setSearchData] = createSignal({
  produce: '',
  quantity: '',
  maxPrice: '',
  location: '',
  organicOnly: false
});
const [results, setResults] = createSignal(sampleOffers);

function handleSearch() {
  const filters = searchData();

  const filtered = sampleOffers.filter((item) => {
    const matchesProduce = !filters.produce || item.produceType.toLowerCase().includes(filters.produce.toLowerCase());
    const matchesLocation = !filters.location || item.location.toLowerCase() === filters.location.toLowerCase();
    const matchesPrice = !filters.maxPrice || Number(item.pricePerUnit) <= Number(filters.maxPrice);
    const matchesOrganic = !filters.organicOnly || item.isOrganic;
    const matchesQuantity = !filters.quantity || Number(item.quantity) >= Number(filters.quantity);

    return matchesProduce && matchesLocation && matchesPrice && matchesOrganic && matchesQuantity;
  });

  setResults(filtered);
}
</script>

<div class="card">
  <div class="card-header">
    <span class="icon">??</span>
    <h2>Find Produce</h2>
  </div>

  <form on:submit|preventDefault={handleSearch}>
    <div class="form-grid">
      <div class="form-group">
        <label for="produce">Produce</label>
        <input id="produce" bind:value={searchData().produce} placeholder="Tomatoes" />
      </div>

      <div class="form-group">
        <label for="quantity">Minimum quantity</label>
        <input id="quantity" type="number" bind:value={searchData().quantity} placeholder="200" />
      </div>

      <div class="form-group">
        <label for="price">Max price / unit</label>
        <input id="price" type="number" bind:value={searchData().maxPrice} placeholder="80" />
      </div>

      <div class="form-group">
        <label for="location">Preferred location</label>
        <select id="location" bind:value={searchData().location}>
          <option value="">Any location</option>
          <option value="Nairobi">Nairobi</option>
          <option value="Kisumu">Kisumu</option>
          <option value="Nakuru">Nakuru</option>
        </select>
      </div>
    </div>

    <div class="checkbox-row">
      <label>
        <input type="checkbox" bind:checked={searchData().organicOnly} />
        Organic only
      </label>
    </div>

    <div class="btn-row">
      <button type="submit" class="btn btn-primary">Search</button>
    </div>
  </form>
</div>

<div class="card">
  <div class="card-header">
    <span class="icon">??</span>
    <h2>Available offers</h2>
  </div>

  {#if results.length === 0}
    <p>No offers match your search.</p>
  {:else}
    <div class="offer-grid">
      {#each results as offer (offer.id)}
        <div class="offer-card">
          <div class="offer-header">
            <strong>{offer.produceType}</strong>
            <span class="badge">{offer.location}</span>
          </div>
          <p>Seller: {offer.seller}</p>
          <p>Quantity: {offer.quantity} {offer.unit}</p>
          <p>Price: KES {offer.pricePerUnit} / unit</p>
          <p>Organic: {offer.isOrganic ? 'Yes' : 'No'}</p>
          <p>Available: {offer.availableFrom} to {offer.availableTo}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card {
    background: var(--bg-card);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 1.5rem;
    border: 1px solid var(--border);
    margin-bottom: 1.5rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .card-header h2 {
    margin: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  input, select, button {
    font: inherit;
  }

  input, select {
    width: 100%;
    padding: 0.8rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
  }

  .checkbox-row {
    margin-top: 1rem;
  }

  .btn-row {
    margin-top: 1rem;
  }

  .btn {
    border: 0;
    border-radius: 10px;
    padding: 0.8rem 1.2rem;
    background: var(--primary);
    color: white;
    cursor: pointer;
    font-weight: 600;
  }

  .offer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .offer-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
    padding: 1rem;
  }

  .offer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .badge {
    font-size: 0.72rem;
    background: rgba(45, 106, 79, 0.12);
    color: var(--primary);
    border-radius: 999px;
    padding: 0.25rem 0.6rem;
  }
</style>
