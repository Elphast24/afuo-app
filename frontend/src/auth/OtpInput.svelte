<script>
  import { createEventDispatcher } from 'svelte';

  export let length = 6;
  export let invalid = false;
  export let disabled = false;
  /** id of the element that labels the group */
  export let labelledby = '';
  /** current code (read-only from outside; use clear() to reset) */
  export let value = '';

  const dispatch = createEventDispatcher();

  let digits = Array(length).fill('');
  let inputs = [];

  $: value = digits.join('');

  function focusAt(i) {
    const el = inputs[Math.max(0, Math.min(i, length - 1))];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function commit(next) {
    digits = next;
    if (next.every(Boolean)) dispatch('complete', next.join(''));
  }

  /** Put a run of digits into the boxes starting at i (paste / SMS autofill) */
  function fill(i, text) {
    const next = digits.slice();
    let j = i;
    for (const ch of text) {
      if (j >= length) break;
      next[j++] = ch;
    }
    commit(next);
    focusAt(j);
  }

  function onInput(e, i) {
    const text = e.currentTarget.value.replace(/\D/g, '');
    if (!text) {
      const next = digits.slice();
      next[i] = '';
      digits = next;
      e.currentTarget.value = '';
      return;
    }
    fill(i, text);
    e.currentTarget.value = digits[i];
  }

  function onKeydown(e, i) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const next = digits.slice();
      next[i - 1] = '';
      digits = next;
      focusAt(i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function onPaste(e, i) {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (text) fill(i, text);
  }

  export function clear() {
    digits = Array(length).fill('');
    focusAt(0);
  }

  export function focus() {
    focusAt(digits.findIndex((d) => !d));
  }
</script>

<div class="otp" role="group" aria-labelledby={labelledby || undefined} class:invalid>
  {#each digits as digit, i}
    <input
      bind:this={inputs[i]}
      class="box"
      class:filled={digit}
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      autocomplete={i === 0 ? 'one-time-code' : 'off'}
      aria-label="Digit {i + 1} of {length}"
      aria-invalid={invalid ? 'true' : undefined}
      {disabled}
      value={digit}
      on:input={(e) => onInput(e, i)}
      on:keydown={(e) => onKeydown(e, i)}
      on:paste={(e) => onPaste(e, i)}
      on:focus={(e) => e.currentTarget.select()}
    />
  {/each}
</div>

<style>
  .otp {
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  @media (min-width: 400px) {
    .otp {
      gap: var(--space-2);
    }
  }

  .box {
    flex: 1 1 0;
    min-width: 0;
    max-width: 56px;
    height: 68px;
    padding: 0;
    border: 1.5px solid transparent;
    border-radius: 14px;
    background: #e9ece7;
    color: var(--color-ink);
    font: inherit;
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
    caret-color: var(--color-orange-600);
    transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out);
  }

  .box.filled {
    background: #fff;
    border-color: var(--color-green-700);
  }

  .box:focus-visible {
    outline: none;
    background: #fff;
    border-color: var(--color-green-700);
    box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.28);
  }

  .invalid .box {
    border-color: var(--color-danger);
    background: var(--color-danger-bg);
    animation: shake 320ms var(--ease-out);
  }

  .box:disabled {
    opacity: 0.6;
  }

  @keyframes shake {
    20% { transform: translateX(-4px); }
    50% { transform: translateX(4px); }
    80% { transform: translateX(-2px); }
  }
</style>
