// Shared top-bar nav entry for the Tournaments tab, reused by the trainer and
// student layouts and by the standalone TournamentsPage.
export const TOURNAMENT_NAV = [
  { to: '/tournaments', label: 'Tournois', match: (p: string) => p.startsWith('/tournaments') },
];
