/**
 * Agent panel shared state.
 * Uses writable store for cross-component reactivity + Svelte transitions.
 */
import { writable } from 'svelte/store';

export const agentPanelOpen = writable(false);
