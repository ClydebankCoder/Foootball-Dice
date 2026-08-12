/**
 * The end of a season: where you finished, who went up, who went down.
 */

import { LeagueTable } from '../components/LeagueTable';
import { getClub } from '../data/clubs';
import { getLeague } from '../data/leagues';
import { ordinal } from '../engine/league';
import type { SeasonSummary as Summary } from '../types';

interface Props {
  summary: Summary;
  clubId: string;
  onContinue: () => void;
}

const OUTCOME_HEADLINES: Record<Summary['managerRecord']['outcome'], string> = {
  champion: 'CHAMPIONS',
  promoted: 'PROMOTED',
  relegated: 'RELEGATED',
  none: 'Season over',
};

export function SeasonSummary({ summary, clubId, onContinue }: Props) {
  const club = getClub(clubId);
  const record = summary.managerRecord;
  const movingUp = record.outcome === 'promoted' || record.outcome === 'champion';
  const movingDown = record.outcome === 'relegated';

  return (
    <div className="stack">
      <section
        className={`card card--centred season-banner ${
          movingUp ? 'is-up' : movingDown ? 'is-down' : ''
        }`}
      >
        <p className="eyebrow">Season {summary.season} · {getLeague(summary.league).name}</p>
        <h1 className="season-banner__headline">{OUTCOME_HEADLINES[record.outcome]}</h1>
        <p className="season-banner__club">{club.name}</p>
        <p className="muted">
          Finished {ordinal(record.position)} · {record.points} points
        </p>

        {summary.nextLeague !== summary.league && (
          <p className={`season-banner__move ${movingUp ? 'is-up' : 'is-down'}`}>
            {movingUp ? 'Up to' : 'Down to'} {getLeague(summary.nextLeague).name}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Your season</h2>
        <dl className="stat-row stat-row--pairs">
          <Stat label="Played" value={record.played} />
          <Stat label="Won" value={record.won} />
          <Stat label="Drawn" value={record.drawn} />
          <Stat label="Lost" value={record.lost} />
          <Stat label="Goals for" value={record.goalsFor} />
          <Stat label="Goals against" value={record.goalsAgainst} />
        </dl>
      </section>

      {summary.divisions.map((division) => (
        <section className="card" key={division.league}>
          <h2 className="card__title">{getLeague(division.league).name}</h2>
          <LeagueTable
            rows={division.table}
            highlightClubId={clubId}
            promoted={division.promoted}
            relegated={division.relegated}
          />
          <p className="muted small season-moves">
            {division.promoted.length > 0 && (
              <span className="is-success">
                Up: {division.promoted.map((id) => getClub(id).shortName).join(', ')}
              </span>
            )}
            {division.promoted.length > 0 && division.relegated.length > 0 && ' · '}
            {division.relegated.length > 0 && (
              <span className="is-failure">
                Down: {division.relegated.map((id) => getClub(id).shortName).join(', ')}
              </span>
            )}
          </p>
        </section>
      ))}

      <button type="button" className="btn btn--primary btn--block" onClick={onContinue}>
        Start season {summary.season + 1}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
    </div>
  );
}
