/**
 * The cup bracket: every round, every tie, and how far you got.
 */

import { getClub } from '../data/clubs';
import { CUP_ROUNDS, FINAL_ROUND, getCupRound } from '../data/cup';
import { progressLabel, tiesInRound } from '../engine/cup';
import type { Career, CupTie } from '../types';

interface Props {
  career: Career;
}

export function CupScreen({ career }: Props) {
  const cup = career.cup;
  if (!cup) return null;

  const rounds = CUP_ROUNDS.filter((round) => tiesInRound(cup, round.index).length > 0);

  return (
    <div className="stack">
      <section className="card">
        <h1 className="card__title">Scottish Cup · Season {career.season}</h1>
        <p className="muted">
          {getClub(career.clubId).name} — {progressLabel(cup, career.clubId)}
        </p>
        <p className="muted small">
          Open draw, one tie, no replays. Level after 120 minutes and it goes to
          penalties.
        </p>
      </section>

      {career.cupSeasons.length > 0 && (
        <section className="card">
          <h2 className="card__title">Previous runs</h2>
          <ul className="seasons">
            {[...career.cupSeasons].reverse().map((run) => (
              <li className="season-row" key={run.season}>
                <span className="season-row__number">S{run.season}</span>
                <span className="season-row__league">
                  {run.won
                    ? 'Won the cup'
                    : run.runnerUp
                      ? 'Lost the final'
                      : `Out in the ${getCupRound(run.roundReached).name}`}
                </span>
                {run.won && <span className="season-row__outcome is-champion">Winners</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {[...rounds].reverse().map((round) => (
        <section className="card" key={round.index}>
          <h2 className="card__title">
            {round.name}
            {round.index === cup.round && !cup.winnerClubId && (
              <span className="round-badge">Current</span>
            )}
          </h2>
          <ul className="fixtures">
            {tiesInRound(cup, round.index).map((tie) => (
              <TieRow key={tie.id} tie={tie} clubId={career.clubId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TieRow({ tie, clubId }: { tie: CupTie; clubId: string }) {
  const home = getClub(tie.homeClubId);
  const away = getClub(tie.awayClubId);
  const yours = tie.homeClubId === clubId || tie.awayClubId === clubId;

  return (
    <li className={`fixture-row ${yours ? 'is-you' : ''}`}>
      <span
        className={`fixture-row__club fixture-row__club--home ${
          tie.winnerClubId === tie.homeClubId ? 'is-mine' : ''
        }`}
      >
        {home.shortName}
      </span>
      <span className="fixture-row__score fixture-row__score--cup">
        {tie.played ? `${tie.homeScore}–${tie.awayScore}` : 'v'}
      </span>
      <span
        className={`fixture-row__club ${
          tie.winnerClubId === tie.awayClubId ? 'is-mine' : ''
        }`}
      >
        {away.shortName}
      </span>
      {tie.shootout && (
        <span className="fixture-row__pens">
          pens {tie.shootout.home}–{tie.shootout.away}
        </span>
      )}
    </li>
  );
}

export { FINAL_ROUND };
