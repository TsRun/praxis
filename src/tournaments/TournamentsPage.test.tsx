import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TournamentsPage } from './TournamentsPage';
import * as apiMod from '../lib/api';
import type { TournamentRow } from '../lib/api';

// TopBar (rendered by the page) calls useAuth(); stub it so the test doesn't
// need the full AuthProvider/network stack.
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const sample: TournamentRow[] = [
  {
    id: 1, name: 'Open de Paris', url: 'https://x', country: 'FRA',
    location: 'PARIS', region: 'Île-de-France', department: 'Paris (75)',
    lat: 48.85, lon: 2.35, start_date: '2026-06-12', end_date: '2026-06-20',
    players: 120, cadence: 'classic', time_control: 'Standard: 90 min',
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiMod.tournaments, 'list').mockResolvedValue(sample);
  vi.spyOn(apiMod.tournaments, 'regions').mockResolvedValue(['Île-de-France']);
  // jsdom has no window.open; stub it for the map onSelect path.
  vi.stubGlobal('open', vi.fn());
});

describe('TournamentsPage', () => {
  it('renders the list, then toggles to the map view', async () => {
    render(<MemoryRouter><TournamentsPage /></MemoryRouter>);
    expect(await screen.findByText('Open de Paris')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));
    await waitFor(() => expect(document.querySelector('svg')).toBeInTheDocument());
  });

  it('applies the cadence filter via the API', async () => {
    const listSpy = vi.spyOn(apiMod.tournaments, 'list').mockResolvedValue(sample);
    render(<MemoryRouter><TournamentsPage /></MemoryRouter>);
    await screen.findByText('Open de Paris');

    fireEvent.click(screen.getByRole('button', { name: 'Rapide' }));
    await waitFor(() =>
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ cadence: 'rapid' })),
    );
  });
});
