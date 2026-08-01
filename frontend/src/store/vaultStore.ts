import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface VaultState {
  masterPassword: string | null;
  setMasterPassword: (password: string | null) => void;
  isUnlocked: boolean;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set) => ({
      masterPassword: null,
      setMasterPassword: (password) => set({ masterPassword: password, isUnlocked: !!password }),
      isUnlocked: false,
    }),
    {
      name: 'vault-storage',
      storage: createJSONStorage(() => sessionStorage), // Persist during session (survives refresh)
    }
  )
);
