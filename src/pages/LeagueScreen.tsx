import { LeagueTable } from '../components/LeagueTable';
import { getClub, LEAGUE_NAMES } from '../data/clubs';
import { tableFor } from '../state/career';
import type { Career, Fixture } from '../types';

interface Props {
  career: Career;
}

export function LeagueScreen({ career }: Props) {
  const table = tableFor(career);
  const club = getClub(career.clubId);
  // Most recent first — the last result is the one you want to see.
  const results = career.fixtures.filter((f) => f.played).reverse();
  const upcoming = career.fixtures.filter((f) => !f.played);

  return (
    <div className="stack">
      <section className="card">
        <h1 className="card__title">{LEAGUE_NAMES[club.league]}</h1>
        <LeagueTable rows={table} highlightClubId={career.clubId} />
      </section>

      <section className="card">
        <h2 className="card__title">Results</h2>
        {results.length === 0 ? (
          <p className="muted">Nothing played yet.</p>
        ) : (
          <ul className="fixtures">
            {results.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} clubId={career.clubId} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Still to play</h2>
        {upcoming.length === 0 ? (
          <p className="muted">That's the season done.</p>
        ) : (
          <ul className="fixtures">
            {upcoming.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} clubId={career.clubId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FixtureRow({ fixture, clubId }: { fixture: Fixture; clubId: string }) {
  const home = getClub(fixture.homeClubId);
  const away = getClub(fixture.awayClubId);
  const involvesYou = fixture.homeClubId === clubId || fixture.awayClubId === clubId;

  return (
    <li className={`fixture-row ${involvesYou ? 'is-you' : ''}`}>
      <span className="fixture-row__round">R{fixture.round}</span>
      <span
        className={`fixture-row__club fixture-row__club--home ${
          fixture.homeClubId === clubId ? 'is-mine' : ''
        }`}
      >
        {home.shortName}
      </span>
      <span className="fixture-row__score">
        {fixture.played ? `${fixture.homeScore}–${fixture.awayScore}` : 'v'}
      </span>
      <span
        className={`fixture-row__club ${fixture.awayClubId === clubId ? 'is-mine' : ''}`}
      >
        {away.shortName}
      </span>
    </li>
  );
}
