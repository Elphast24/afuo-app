<script>
  import { Link } from 'svelte-navigator';
  import { TrendingUp, TrendingDown, MapPin, Activity, Sprout, MoveHorizontal, Trophy, Lightbulb, ArrowRight } from 'lucide-svelte';

  /** { kind, tone: good|watch|info, trend?, title, detail, produce?, personal? } */
  export let insight;

  const ICONS = { mover: TrendingUp, 'cheapest-town': MapPin, activity: Activity, organic: Sprout, spread: MoveHorizontal, top: Trophy, yours: Lightbulb };
  $: icon = insight.kind === 'mover' && insight.trend === 'down' ? TrendingDown : (ICONS[insight.kind] ?? Lightbulb);
  const TONE = { good: 'Good news', watch: 'Worth watching', info: 'Good to know' };
</script>

<article class="insight {insight.tone}">
  <span class="ico"><svelte:component this={icon} size={20} aria-hidden="true" /></span>
  <div class="txt">
    <p class="tag">{insight.personal ? 'Your listing' : TONE[insight.tone]}</p>
    <h3>{insight.title}</h3>
    <p class="detail">{insight.detail}</p>
    {#if insight.produce}
      <Link to="/marketplace?q={encodeURIComponent(insight.produce)}" class="more">See {insight.produce} listings <ArrowRight size={14} aria-hidden="true" /></Link>
    {/if}
  </div>
</article>

<style>
  .insight { display: flex; gap: var(--space-3); height: 100%; padding: var(--space-4); border-radius: var(--radius-md); background: #fff; box-shadow: var(--shadow-sm); }
  .insight.good { background: var(--tint-green); }
  .insight.watch { background: var(--tint-butter); }
  .ico { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 50%; background: #fff; color: var(--color-ink); }
  .good .ico { color: var(--color-green-700); }
  .watch .ico { color: var(--color-orange-700); }
  .txt { display: grid; align-content: start; gap: 2px; min-width: 0; }
  .tag { font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted); }
  h3 { font-size: var(--text-base); font-weight: 700; }
  .detail { font-size: var(--text-sm); color: var(--color-muted); }
  .txt :global(.more) { display: inline-flex; align-items: center; gap: var(--space-1); min-height: 44px; margin-top: var(--space-1); font-size: var(--text-sm); font-weight: 600; color: var(--color-ink); text-decoration: underline; text-underline-offset: 3px; }
</style>
