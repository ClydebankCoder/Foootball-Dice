import { getClub } from '../data/clubs';
import { getLeague } from '../data/leagues';
import { getClubWithSquad } from '../data/world';
import { ordinal, positionOf } from '../engine/league';
import {
  currentDivisionClubs,
  currentLeague,
  nextFixture,
  seasonComplete,
  tableFor,
} from '../state/career';
import type { Career } from '../types';

interface Props {
  career: Career;
  onPlayMatch: () => void;
  onFinishSeason: () => void;
  onShowTutorial: () => void;
}

export function Dashboard({
  career,
  onPlayMatch,
  onFinishSeason,
  onShowTutorial,
}: Props) {
  const club = getClubWithSquad(career.clubId);
  const league = getLeague(currentLeague(career));
  const table = tableFor(career);
  const row = table.find((r) => r.clubId === career.clubId)!;
  const position = positionOf(table, career.clubId);
  const fixture = nextFixture(career);
  const finished = seasonComplete(career);
  const records = career.records;
  const matchesLeft = career.fixtures.filter(
    (f) =>
      !f.played && (f.homeClubId === career.clubId || f.awayClubId === career.clubId),
  ).length;

  return (
    <div className="stack">
      <section className="card card--club" style={{ borderTopColor: club.primaryColour }}>
        <p className="eyebrow">Welcome, {career.managerName}</p>
        <h1 className="club-title">{club.name}</h1>
        <p className="muted">
          {league.name} · Season {career.season} · {ordinal(position)} · {row.points} pts
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">{finished ? 'Season complete' : 'Next match'}</h2>
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
                : `Away at ${getClub(fixture.homeClubId).stadium}`}{' '}
              · {matchesLeft} left
            </p>
            <button type="button" className="btn btn--primary btn--block" onClick={onPlayMatch}>
              Play match
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Every fixture is played. Settle the other divisions and find out who is
              going up and who is going down.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={onFinishSeason}
            >
              Finish the season
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Season</h2>
        <dl className="stat-row">
          <Stat label="Played" value={row.played} />
          <Stat label="Won" value={row.won} />
          <Stat label="Drawn" value={row.drawn} />
          <Stat label="Lost" value={row.lost} />
          <Stat label="GF" value={row.goalsFor} />
          <Stat label="GA" value={row.goalsAgainst} />
        </dl>
        <p className="muted small">
          {league.name} · {currentDivisionClubs(career).length} clubs
        </p>
      </section>

      {career.seasons.length > 0 && (
        <section className="card">
          <h2 className="card__title">Career</h2>
          <ul className="seasons">
            {[...career.seasons].reverse().map((season) => (
              <li className="season-row" key={season.season}>
                <span className="season-row__number">S{season.season}</span>
                <span className="season-row__league">{getLeague(season.league).shortName}</span>
                <span className="season-row__pos">{ordinal(season.position)}</span>
                <span className="season-row__pts">{season.points} pts</span>
                {season.outcome !== 'none' && (
                  <span className={`season-row__outcome is-${season.outcome}`}>
                    {season.outcome === 'champion'
                      ? 'Champions'
                      : season.outcome === 'promoted'
                        ? 'Promoted'
                        : 'Relegated'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Manager records</h2>
        <dl className="stat-row stat-row--pairs">
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

      <button type="button" className="btn btn--ghost btn--block" onClick={onShowTutorial}>
        How the dice work
      </button>
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
