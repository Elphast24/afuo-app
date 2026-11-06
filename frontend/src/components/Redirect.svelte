<script>
  import { onMount } from 'svelte';
  import { useNavigate } from 'svelte-navigator';

  export let to;
  const navigate = useNavigate();
  onMount(() => navigate(to, { replace: true }));
</script>
