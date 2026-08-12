import { LeagueTable } from '../components/LeagueTable';
import { getClub } from '../data/clubs';
import { LEAGUES } from '../data/leagues';
import { currentLeague, tableFor } from '../state/career';
import type { Career, Fixture } from '../types';

interface Props {
  career: Career;
}

export function LeagueScreen({ career }: Props) {
  const table = tableFor(career);
  const league = currentLeague(career);
  // Most recent first — the last result is the one you want to see.
  const results = career.fixtures.filter((f) => f.played).reverse();
  const upcoming = career.fixtures.filter(
    (f) =>
      !f.played && (f.homeClubId === career.clubId || f.awayClubId === career.clubId),
  );

  return (
    <div className="stack">
      <section className="card">
        <h1 className="card__title">
          {LEAGUES.find((l) => l.id === league)!.name} · Season {career.season}
        </h1>
        <LeagueTable rows={table} highlightClubId={career.clubId} />
        <p className="muted small">
          One club goes up and one goes down between each division at the end of the
          season.
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">Your remaining fixtures</h2>
        {upcoming.length === 0 ? (
          <p className="muted">That's your season done.</p>
        ) : (
          <ul className="fixtures">
            {upcoming.slice(0, 8).map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} clubId={career.clubId} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Latest results</h2>
        {results.length === 0 ? (
          <p className="muted">Nothing played yet.</p>
        ) : (
          <ul className="fixtures">
            {results.slice(0, 12).map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} clubId={career.clubId} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">The pyramid</h2>
        <p className="muted small">
          Where every club sits this season. The divisions you are not in are played out
          at the final whistle of the season.
        </p>
        {LEAGUES.map((definition) => (
          <div className="pyramid" key={definition.id}>
            <h3 className="pyramid__name">{definition.name}</h3>
            <p className="pyramid__clubs">
              {(career.divisions[definition.id] ?? []).map((clubId, index) => (
                <span
                  key={clubId}
                  className={`pyramid__club ${clubId === career.clubId ? 'is-you' : ''}`}
                >
                  {index > 0 && ' · '}
                  {getClub(clubId).shortName}
                </span>
              ))}
            </p>
          </div>
        ))}
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
