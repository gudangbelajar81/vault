import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Store terpusat untuk draft "Meja Kerja" (SmartNotepad).
 * Dipakai bersama oleh SmartNotepad & SmartCalculator agar komunikasi
 * antar-komponen tidak lagi pakai DOM-hack (querySelector + dispatchEvent),
 * cukup baca/tulis state Zustand yang sama. Tetap persist ke localStorage
 * supaya draft tidak hilang saat reload (perilaku lama dipertahankan).
 */
interface NotepadDraftState {
  draft: string;
  setDraft: (text: string) => void;
  appendDraft: (text: string) => void;
  clearDraft: () => void;
}

export const useNotepadDraftStore = create<NotepadDraftState>()(
  persist(
    (set, get) => ({
      draft: '',
      setDraft: (text) => set({ draft: text }),
      appendDraft: (text) => set({ draft: get().draft + text }),
      clearDraft: () => set({ draft: '' }),
    }),
    {
      name: 'notepad_draft_store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
