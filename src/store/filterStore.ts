import { create } from 'zustand';

export type ColorFilter = 'any' | 'white' | 'black';

export interface PlayerLite {
  fide_id: number;
  name: string;
  country: string | null;
  title: string | null;
  rating: number | null;
}

interface FilterState {
  player: PlayerLite | null;
  color: ColorFilter;
  setPlayer: (p: PlayerLite | null) => void;
  setColor: (c: ColorFilter) => void;
  clear: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  player: null,
  color: 'any',
  setPlayer(p) {
    set({ player: p });
  },
  setColor(c) {
    set({ color: c });
  },
  clear() {
    set({ player: null, color: 'any' });
  },
}));
