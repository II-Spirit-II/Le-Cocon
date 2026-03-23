<script lang="ts">
  interface Props {
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date' | 'time';
    value?: string;
    placeholder?: string;
    label?: string;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    id?: string;
    class?: string;
    max?: string;
    min?: string;
    minlength?: number;
    maxlength?: number;
    oninput?: (e: Event) => void;
  }

  let {
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    label,
    error,
    disabled = false,
    required = false,
    name,
    id,
    class: className = '',
    max,
    min,
    minlength,
    maxlength,
    oninput
  }: Props = $props();

  const randomId = `input-${Math.random().toString(36).slice(2, 9)}`;
  const inputId = $derived(id || name || randomId);
  const errorId = $derived(`${inputId}-error`);
</script>

<div class="w-full {className}">
  {#if label}
    <label for={inputId} class="block text-sm font-semibold text-warm-700 mb-1.5">
      {label}
      {#if required}<span class="text-argile-400">*</span>{/if}
    </label>
  {/if}
  <input
    {type}
    {name}
    id={inputId}
    bind:value
    {placeholder}
    {disabled}
    {required}
    {max}
    {min}
    {minlength}
    {maxlength}
    {oninput}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? errorId : undefined}
    class="input-soie disabled:opacity-50 disabled:cursor-not-allowed {error ? 'input-error' : ''}"
  />
  {#if error}
    <p id={errorId} class="mt-1.5 text-sm text-argile-500" role="alert">{error}</p>
  {/if}
</div>

<style>
  .input-soie {
    display: block;
    width: 100%;
    border-radius: 0.75rem;
    padding: 0.625rem 1rem;
    color: var(--color-warm-900);
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    transition: all 0.3s ease;
  }

  .input-soie::placeholder {
    color: var(--color-warm-500);
  }

  .input-soie:focus {
    border-color: rgba(232, 145, 58, 0.5);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.12), 0 0 20px rgba(232, 145, 58, 0.08);
    outline: none;
  }

  .input-soie.input-error {
    border-color: var(--color-argile-400);
  }

  .input-soie.input-error:focus {
    border-color: var(--color-argile-500);
    box-shadow: 0 0 0 3px rgba(212, 115, 106, 0.15);
  }
</style>
