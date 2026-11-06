<script>
  import { Link } from 'svelte-navigator';
  import { ArrowUpRight, Smartphone, Target, BarChart3, Globe } from 'lucide-svelte';
  import SiteHeader from './components/SiteHeader.svelte';
  import SiteFooter from './components/SiteFooter.svelte';
  import { session } from './lib/auth.js';

  // Send visitors to sign in first; signed-in users go straight to the right place
  $: startTo = $session ? '/dashboard' : '/login';
  $: farmerTo = $session ? '/listings/new' : '/login';
  $: buyerTo = $session ? '/marketplace' : '/login';

  const stats = [
    { value: '12K+', label: 'Farmers\nonboarded' },
    { value: '85%', label: 'Listings\nmatched' },
    { value: '30+', label: 'Produce\ncategories' }
  ];

  const features = [
    { icon: Smartphone, title: 'Phone + OTP sign-in', text: 'No email needed, so it works for rural farming communities.' },
    { icon: Target, title: 'Smart matching', text: 'Weighted scoring by produce type, quantity, location, price and availability.' },
    { icon: BarChart3, title: 'Live market analytics', text: 'Price trends and market insight to decide what to plant and when to sell.' },
    { icon: Globe, title: 'Wide coverage', text: 'Reach farmers and buyers across locations and produce categories.' }
  ];

  const steps = [
    { title: 'Register & authenticate', text: 'Use your phone number and an OTP for quick, secure access.' },
    { title: 'List or search', text: 'Farmers create listings; buyers search with smart filters.' },
    { title: 'Get matched', text: 'Matching surfaces the best fits for your preferences.' },
    { title: 'Connect & trade', text: 'Message farmers, negotiate prices and complete the sale.' }
  ];

  const testimonials = [
    { quote: 'AgriMatch made it easy to sell my tomatoes directly to buyers in Accra. I got a better price than the middleman.', name: 'Kwame Mensah', role: 'Tomato farmer, Techiman' },
    { quote: 'As a buyer I can find exactly the right quantity of maize at competitive prices. The matching is spot on.', name: 'Ama Serwaa', role: 'Grain buyer, Accra' },
    { quote: 'The analytics help me plan my planting. I can see price trends and adjust my quantities.', name: 'Kofi Boateng', role: 'Farm manager, Kumasi' }
  ];

  const initials = (name) => name.split(' ').map((p) => p[0]).join('');
</script>

<div class="landing">
  <!-- Fullscreen hero -->
  <section class="hero" aria-labelledby="hero-title">
    <img
      class="hero-img"
      src="/images/hero-farmer.jpg"
      alt="A woman harvesting dried maize in a field in Ghana"
      width="1920"
      height="1280"
      fetchpriority="high"
    />
    <div class="hero-scrim" aria-hidden="true"></div>

    <SiteHeader current="home" />

    <div class="hero-body">
      <h1 id="hero-title">Connecting Farmers,<br />Growing Fair Markets<br />Across Ghana</h1>

      <div class="hero-right">
        <ul class="stats" aria-label="Platform highlights">
          {#each stats as s}
            <li class="stat">
              <span class="stat-value">{s.value}</span>
              <span class="stat-label">{s.label}</span>
            </li>
          {/each}
        </ul>

        <div class="notch">
          <p>
            We connect small-scale farmers directly with buyers through smart matching and real-time market
            insight, so every harvest finds a fair price.
          </p>
          <Link to={startTo} class="btn btn-primary">
            <span>Get Started</span>
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="section" aria-labelledby="features-title">
    <div class="container">
      <p class="eyebrow">Why AgriMatch</p>
      <h2 id="features-title" class="section-title">Built for how farmers and buyers actually trade</h2>
      <div class="features">
        {#each features as f}
          <article class="feature">
            <span class="icon-chip"><svelte:component this={f.icon} size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section class="section section-cream" aria-labelledby="how-title">
    <div class="container">
      <p class="eyebrow">How it works</p>
      <h2 id="how-title" class="section-title">From sign-up to sale in four steps</h2>
      <ol class="steps">
        {#each steps as s, i}
          <li class="step">
            <span class="step-num">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <!-- Testimonials -->
  <section class="section" aria-labelledby="voices-title">
    <div class="container">
      <p class="eyebrow">Voices</p>
      <h2 id="voices-title" class="section-title">What our users say</h2>
      <div class="quotes">
        {#each testimonials as t}
          <figure class="quote">
            <blockquote>{t.quote}</blockquote>
            <figcaption>
              <span class="avatar" aria-hidden="true">{initials(t.name)}</span>
              <span>
                <strong>{t.name}</strong>
                <small>{t.role}</small>
              </span>
            </figcaption>
          </figure>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta-band" aria-labelledby="cta-title">
    <div class="container cta-inner">
      <div>
        <h2 id="cta-title">Ready to sell or source smarter?</h2>
        <p>Join the farmers and buyers already trading on AgriMatch.</p>
      </div>
      <div class="cta-actions">
        <Link to={farmerTo} class="btn btn-primary">
          <span>Register as Farmer</span>
          <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
        <Link to={buyerTo} class="btn btn-ghost-light">Find Produce</Link>
      </div>
    </div>
  </section>

  <SiteFooter />
</div>

<style>
  /* ---------- Fullscreen hero ---------- */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 100dvh;
    overflow: hidden;
    color: #fff;
    background: var(--color-green-900);
  }

  .hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: cover;
    object-position: 50% 20%;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(10, 24, 16, 0.6) 0%,
      rgba(10, 24, 16, 0) 24%,
      rgba(10, 24, 16, 0) 38%,
      rgba(10, 24, 16, 0.9) 100%
    );
  }

  .hero-body {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: 11rem var(--gutter) 0;
  }

  .hero h1 {
    font-size: var(--text-display);
    font-weight: 500;
    letter-spacing: -0.025em;
    text-shadow: 0 2px 24px rgba(0, 0, 0, 0.35);
  }

  .hero-right {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* Overlapping outlined stat circles */
  .stats {
    display: flex;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .stat {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 36%;
    max-width: 10.5rem;
    margin-left: -4%;
    aspect-ratio: 1;
    border: 1px solid rgba(255, 255, 255, 0.65);
    border-radius: 50%;
    background: rgba(10, 24, 16, 0.28);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    text-align: center;
  }
  .stat:first-child {
    margin-left: 0;
  }

  .stat-value {
    font-size: clamp(1.25rem, 5.4vw, 2.25rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .stat-label {
    white-space: pre-line;
    font-size: var(--text-xs);
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.92);
  }

  /* Notch: white panel flush to the bottom edge, holding the blurb + CTA */
  .notch {
    display: grid;
    gap: var(--space-4);
    margin-inline: calc(var(--gutter) * -1);
    padding: var(--space-6) var(--gutter) var(--space-8);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .notch p {
    max-width: 46ch;
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  .notch :global(.btn) {
    justify-self: start;
  }

  .hero :global(.btn-primary:focus-visible) {
    outline-color: var(--color-green-900);
  }

  @media (min-width: 960px) {
    .hero-body {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-8);
      padding-right: 0;
    }

    .hero h1 {
      align-self: flex-end;
      padding-bottom: var(--space-12);
    }

    .hero-right {
      align-items: flex-end;
      flex: none;
      width: min(46%, 600px);
    }

    .stats {
      margin-right: var(--gutter);
    }

    .stat {
      width: 10rem;
      margin-left: -1.25rem;
    }

    .notch {
      position: relative;
      width: 100%;
      margin: 0;
      padding: var(--space-8) var(--gutter) var(--space-8) var(--space-8);
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: var(--space-6);
      border-radius: var(--radius-lg) 0 0 0;
    }

    /* Concave fillet where the notch meets the bottom edge on its left */
    .notch::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: -28px;
      width: 28px;
      height: 28px;
      pointer-events: none;
      background: radial-gradient(circle at 0 0, transparent 27.5px, var(--color-surface) 28px);
    }
  }

  /* Short landscape screens: keep the headline from crowding the header */
  @media (max-height: 560px) {
    .hero-body {
      padding-top: 8rem;
    }
  }

  /* ---------- Sections (full-bleed bands) ---------- */
  .section {
    padding: var(--space-16) 0;
    background: var(--color-surface);
  }

  .section-cream {
    background: var(--color-bg);
  }

  .section-title {
    max-width: 22ch;
    margin: var(--space-2) 0 var(--space-8);
    font-size: var(--text-title);
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  .features,
  .steps,
  .quotes {
    display: grid;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .features {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  }

  .steps {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }

  .quotes {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }

  .feature,
  .step,
  .quote {
    margin: 0;
    padding: var(--space-6);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .feature {
    transition: border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
  }

  .feature:hover {
    border-color: var(--color-green-700);
    transform: translateY(-3px);
  }

  .feature .icon-chip,
  .step-num {
    margin-bottom: var(--space-4);
  }

  .feature h3,
  .step h3 {
    margin-bottom: var(--space-2);
    font-size: var(--text-lg);
  }

  .feature p,
  .step p {
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  .step-num {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--color-line-strong);
    border-radius: 50%;
    font-weight: 600;
    color: var(--color-orange-700);
  }

  .quote {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-6);
  }

  .quote blockquote {
    margin: 0;
  }

  .quote figcaption {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .quote figcaption strong,
  .quote figcaption small {
    display: block;
  }

  .quote figcaption small {
    font-size: var(--text-xs);
    color: var(--color-muted);
  }

  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-green-900);
    color: #fff;
    font-size: var(--text-xs);
    font-weight: 600;
  }

  /* ---------- CTA band ---------- */
  .cta-band {
    padding: var(--space-16) 0;
    background: var(--color-green-700);
    color: #fff;
  }

  .cta-band :global(a:focus-visible) {
    outline-color: #fff;
  }

  .cta-inner {
    display: grid;
    gap: var(--space-6);
    align-items: center;
  }

  .cta-band h2 {
    margin-bottom: var(--space-2);
    font-size: var(--text-title);
    font-weight: 500;
  }

  .cta-band p {
    color: var(--color-on-dark-muted);
  }

  .cta-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  @media (min-width: 800px) {
    .cta-inner {
      grid-template-columns: 1fr auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .feature:hover {
      transform: none;
    }
  }
</style>
