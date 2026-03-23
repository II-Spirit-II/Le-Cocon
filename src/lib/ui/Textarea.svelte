<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    label?: string;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    id?: string;
    rows?: number;
    maxlength?: number;
    class?: string;
    oninput?: (e: Event) => void;
  }

  let {
    value = $bindable(''),
    placeholder = '',
    label,
    error,
    disabled = false,
    required = false,
    name,
    id,
    rows = 4,
    maxlength,
    class: className = '',
    oninput
  }: Props = $props();

  const randomId = `textarea-${Math.random().toString(36).slice(2, 9)}`;
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
  <textarea
    {name}
    id={inputId}
    bind:value
    {placeholder}
    {disabled}
    {required}
    {rows}
    {maxlength}
    {oninput}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? errorId : undefined}
    class="textarea-soie resize-none disabled:opacity-50 disabled:cursor-not-allowed {error ? 'textarea-error' : ''}"
  ></textarea>
  {#if error}
    <p id={errorId} class="mt-1.5 text-sm text-argile-500" role="alert">{error}</p>
  {/if}
</div>

<style>
  .textarea-soie {
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

  .textarea-soie::placeholder {
    color: var(--color-warm-500);
  }

  .textarea-soie:focus {
    border-color: rgba(232, 145, 58, 0.5);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.12), 0 0 20px rgba(232, 145, 58, 0.08);
    outline: none;
  }

  .textarea-soie.textarea-error {
    border-color: var(--color-argile-400);
  }

  .textarea-soie.textarea-error:focus {
    border-color: var(--color-argile-500);
    box-shadow: 0 0 0 3px rgba(212, 115, 106, 0.15);
  }
</style>
