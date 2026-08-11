import { getClub, LEAGUE_NAMES } from '../data/clubs';
import { getClubWithSquad } from '../data/world';
import { ordinal, positionOf } from '../engine/league';
import { nextFixture, tableFor } from '../state/career';
import type { Career } from '../types';
import { LeagueTable } from '../components/LeagueTable';

interface Props {
  career: Career;
  onPlayMatch: () => void;
}

export function Dashboard({ career, onPlayMatch }: Props) {
  const club = getClubWithSquad(career.clubId);
  const table = tableFor(career);
  const row = table.find((r) => r.clubId === career.clubId)!;
  const position = positionOf(table, career.clubId);
  const fixture = nextFixture(career);
  const records = career.records;

  return (
    <div className="stack">
      <section className="card card--club" style={{ borderTopColor: club.primaryColour }}>
        <p className="eyebrow">Welcome, {career.managerName}</p>
        <h1 className="club-title">{club.name}</h1>
        <p className="muted">
          {LEAGUE_NAMES[club.league]} · {ordinal(position)} · {row.points} pts
        </p>

        <dl className="stat-row">
          <Stat label="Played" value={row.played} />
          <Stat label="Won" value={row.won} />
          <Stat label="Drawn" value={row.drawn} />
          <Stat label="Lost" value={row.lost} />
          <Stat label="GF" value={row.goalsFor} />
          <Stat label="GA" value={row.goalsAgainst} />
        </dl>
      </section>

      <section className="card">
        <h2 className="card__title">Next match</h2>
        {fixture ? (
          <>
            <div className="fixture">
              <span className="fixture__club">{getClub(fixture.homeClubId).name}</span>
              <span className="fixture__vs">v</span>
              <span className="fixture__club">{getClub(fixture.awayClubId).name}</span>
            </div>
            <p className="muted fixture__meta">
              Round {fixture.round} ·{' '}
              {fixture.homeClubId === career.clubId
                ? `Home at ${club.stadium}`
                : `Away at ${getClub(fixture.homeClubId).stadium}`}
            </p>
            <button type="button" className="btn btn--primary btn--block" onClick={onPlayMatch}>
              Play match
            </button>
          </>
        ) : (
          <p className="muted">
            The season is over. Start a new career from the menu to go again.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Manager records</h2>
        <dl className="stat-row">
          <Stat label="Actions attempted" value={records.actionsAttempted} />
          <Stat label="Successful" value={records.actionsSuccessful} />
          <Stat
            label="Success rate"
            value={
              records.actionsAttempted === 0
                ? '—'
                : `${Math.round((records.actionsSuccessful / records.actionsAttempted) * 100)}%`
            }
          />
          <Stat
            label="Longest odds beaten"
            value={
              records.lowestSuccessfulProbability === null
                ? '—'
                : `${records.lowestSuccessfulProbability}%`
            }
          />
        </dl>
        {records.lowestSuccessfulActionName && (
          <p className="muted">
            Your finest gamble: {records.lowestSuccessfulActionName} at{' '}
            {records.lowestSuccessfulProbability}%.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">{LEAGUE_NAMES[club.league]}</h2>
        <LeagueTable rows={table} highlightClubId={career.clubId} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
    </div>
  );
}
