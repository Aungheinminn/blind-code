import { writable } from "svelte/store";

export const outOfCreditsModalOpen = writable(false);

export const openOutOfCreditsModal = () => outOfCreditsModalOpen.set(true);
export const closeOutOfCreditsModal = () => outOfCreditsModalOpen.set(false);
