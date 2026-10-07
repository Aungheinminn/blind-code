import { writable } from "svelte/store";

export const welcomeModalOpen = writable(false);

export const openWelcomeModal = () => welcomeModalOpen.set(true);
export const closeWelcomeModal = () => welcomeModalOpen.set(false);
