import { describe, it, expect } from 'vitest';
import { classifyCadence, parseGeocodeContext, parseTournamentDetail, parseFideList } from './parse.js';

describe('classifyCadence', () => {
  it('maps the FIDE time-control prefix to our enum', () => {
    expect(classifyCadence('Standard: 90 minutes + 30 sec increment')).toBe('classic');
    expect(classifyCadence('Rapid: 12 minutes for game with 3 seconds increment')).toBe('rapid');
    expect(classifyCadence('Blitz: 3 minutes + 2 sec')).toBe('blitz');
    expect(classifyCadence('')).toBeNull();
    expect(classifyCadence(null)).toBeNull();
  });
});

describe('parseGeocodeContext', () => {
  it('splits the api-adresse context string', () => {
    expect(parseGeocodeContext('50, Manche, Normandie')).toEqual({
      department: 'Manche (50)',
      region: 'Normandie',
    });
  });
  it('returns nulls for empty input', () => {
    expect(parseGeocodeContext('')).toEqual({ department: null, region: null });
  });
});

describe('parseFideList', () => {
  it('maps the a_tournaments.php data rows', () => {
    const json = {
      data: [
        ['472202', 'Tournoi rapide Cristal Verrieres 2026', 'VERRIERES', 's', '2026-06-07', '', 'July 2026', '2026-07-01', '0'],
      ],
    };
    expect(parseFideList(json)).toEqual([
      { sourceRef: '472202', name: 'Tournoi rapide Cristal Verrieres 2026', city: 'VERRIERES', startDate: '2026-06-07', period: '2026-07-01' },
    ]);
  });
  it('returns [] for malformed input', () => {
    expect(parseFideList({})).toEqual([]);
    expect(parseFideList(null)).toEqual([]);
  });
});

describe('parseTournamentDetail', () => {
  const html = `<table>
    <tr><td>Event code</td><td>472202</td></tr>
    <tr><td>Tournament Name</td><td>Tournoi rapide Cristal Verrieres 2026</td></tr>
    <tr><td>City</td><td>VERRIERES</td></tr>
    <tr><td>Country</td><td>FRA</td></tr>
    <tr><td>Number of players</td><td>50</td></tr>
    <tr><td>Start Date</td><td>2026-06-07</td></tr>
    <tr><td>End Date</td><td>2026-06-09</td></tr>
    <tr><td>Date received</td><td>0000-00-00</td></tr>
    <tr><td>Time Control</td><td>Rapid: 12 minutes for game with 3 seconds increment from move 1</td></tr>
    <tr><td>Chief Arbiter</td><td>Guyot, Philippe (FRA)</td></tr>
  </table>`;
  it('extracts the header fields and cadence', () => {
    const r = parseTournamentDetail(html);
    expect(r.name).toBe('Tournoi rapide Cristal Verrieres 2026');
    expect(r.city).toBe('VERRIERES');
    expect(r.country).toBe('FRA');
    expect(r.players).toBe(50);
    expect(r.startDate).toBe('2026-06-07');
    expect(r.endDate).toBe('2026-06-09');
    expect(r.cadence).toBe('rapid');
    expect(r.timeControl).toContain('12 minutes');
  });
});
