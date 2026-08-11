import type { MatchState } from '../types';
import { getClub } from '../data/clubs';

interface Props {
  state: MatchState;
}

export function Scoreboard({ state }: Props) {
  const home = getClub(state.homeClubId);
  const away = getClub(state.awayClubId);

  return (
    <header className="scoreboard">
      <div className="scoreboard__side">
        <span className="scoreboard__abbr" style={{ background: home.primaryColour }}>
          {home.abbreviation}
        </span>
        <span className="scoreboard__name">{home.shortName}</span>
      </div>

      <div className="scoreboard__centre">
        <p className="scoreboard__score">
          {state.homeScore}
          <span className="scoreboard__dash">–</span>
          {state.awayScore}
        </p>
        <p className="scoreboard__minute">
          {state.phase === 'full-time' ? 'FULL TIME' : `${state.minute}'`}
        </p>
      </div>

      <div className="scoreboard__side scoreboard__side--away">
        <span className="scoreboard__name">{away.shortName}</span>
        <span className="scoreboard__abbr" style={{ background: away.primaryColour }}>
          {away.abbreviation}
        </span>
      </div>
    </header>
  );
}
