import { LeagueTable } from '../components/LeagueTable';
import { MatchTimeline } from '../components/MatchTimeline';
import { getClub } from '../data/clubs';
import { summariseDecisions, userIsHome } from '../engine/matchEngine';
import { tableFor } from '../state/career';
import type { Career, MatchState } from '../types';
import { percentage, probabilityBand } from '../utils/format';

interface Props {
  state: MatchState;
  career: Career;
  onDone: () => void;
}

export function MatchResult({ state, career, onDone }: Props) {
  const home = getClub(state.homeClubId);
  const away = getClub(state.awayClubId);
  const decisions = summariseDecisions(state);
  const table = tableFor(career);

  const userScore = userIsHome(state) ? state.homeScore : state.awayScore;
  const theirScore = userIsHome(state) ? state.awayScore : state.homeScore;
  const verdict = userScore > theirScore ? 'Won' : userScore < theirScore ? 'Lost' : 'Drawn';

  return (
    <div className="stack">
      <section className="card card--centred">
        <p className="eyebrow">Full time · {verdict}</p>
        <p className="result__scoreline">
          <span>{home.name}</span>
          <strong>
            {state.homeScore} – {state.awayScore}
          </strong>
          <span>{away.name}</span>
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">Goals</h2>
        {state.goals.length === 0 ? (
          <p className="muted">No goals. Not every match is a classic.</p>
        ) : (
          <ul className="goals">
            {state.goals.map((goal, index) => (
              <li className="goal" key={`${goal.minute}-${index}`}>
                <span className="goal__minute">{goal.minute}'</span>
                <span className="goal__scorer">{goal.scorerName}</span>
                <span className="goal__club">{getClub(goal.teamId).abbreviation}</span>
                {goal.probability !== undefined && (
                  <span className="goal__odds">
                    {goal.probability}% · rolled {goal.roll}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Match stats</h2>
        <StatLine label="Possession" home={`${state.stats.home.possession}%`} away={`${state.stats.away.possession}%`} />
        <StatLine label="Shots" home={state.stats.home.shots} away={state.stats.away.shots} />
        <StatLine label="On target" home={state.stats.home.shotsOnTarget} away={state.stats.away.shotsOnTarget} />
        <StatLine label="Fouls" home={state.stats.home.fouls} away={state.stats.away.fouls} />
        <StatLine label="Yellow cards" home={state.stats.home.yellowCards} away={state.stats.away.yellowCards} />
      </section>

      <section className="card">
        <h2 className="card__title">Your decisions</h2>
        <dl className="stat-row">
          <div className="stat">
            <dt className="stat__label">Attempted</dt>
            <dd className="stat__value">{decisions.attempted}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Successful</dt>
            <dd className="stat__value">{decisions.successful}</dd>
          </div>
          <div className="stat">
            <dt className="stat__label">Success rate</dt>
            <dd className="stat__value">{percentage(decisions.successRate)}</dd>
          </div>
        </dl>

        {decisions.biggestGamble && (
          <div className={`gamble band-border-${probabilityBand(decisions.biggestGamble.probability)}`}>
            <p className="gamble__label">Biggest gamble</p>
            <p className="gamble__action">
              {decisions.biggestGamble.actionName} — {decisions.biggestGamble.probability}%
            </p>
            <p
              className={`gamble__result ${
                decisions.biggestGamble.success ? 'is-success' : 'is-failure'
              }`}
            >
              {decisions.biggestGamble.success ? 'SUCCESS' : 'FAILURE'}
            </p>
          </div>
        )}

        <div className="table-wrap">
          <table className="decisions-table">
            <thead>
              <tr>
                <th scope="col">Min</th>
                <th scope="col">Action</th>
                <th scope="col">Chance</th>
                <th scope="col">Roll</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {state.decisions.map((decision, index) => (
                <tr key={`${decision.minute}-${index}`}>
                  <td>{decision.minute}'</td>
                  <th scope="row">{decision.actionName}</th>
                  <td>{decision.probability}%</td>
                  <td>{decision.roll}</td>
                  <td className={decision.success ? 'is-success' : 'is-failure'}>
                    {decision.success ? 'Success' : 'Failure'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">League table</h2>
        <LeagueTable rows={table} highlightClubId={career.clubId} />
      </section>

      <section className="card">
        <h2 className="card__title">Full commentary</h2>
        <MatchTimeline log={state.log} />
      </section>

      <button type="button" className="btn btn--primary btn--block" onClick={onDone}>
        Back to the dashboard
      </button>
    </div>
  );
}

function StatLine({
  label,
  home,
  away,
}: {
  label: string;
  home: number | string;
  away: number | string;
}) {
  return (
    <div className="stat-line">
      <span className="stat-line__home">{home}</span>
      <span className="stat-line__label">{label}</span>
      <span className="stat-line__away">{away}</span>
    </div>
  );
}
