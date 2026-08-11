import { useEffect, useState } from 'react';
import { ClubSelect } from './pages/ClubSelect';
import { Dashboard } from './pages/Dashboard';
import { MatchResult } from './pages/MatchResult';
import { MatchScreen } from './pages/MatchScreen';
import { SquadScreen } from './pages/SquadScreen';
import { TacticsScreen } from './pages/TacticsScreen';
import { createMatch, summariseMatch } from './engine/matchEngine';
import {
  clearCareer,
  completeFixture,
  createCareer,
  loadCareer,
  nextFixture,
  saveCareer,
  setTactics,
} from './state/career';
import type { Career, MatchState, Tactics } from './types';

type Screen = 'dashboard' | 'squad' | 'tactics';

export default function App() {
  const [career, setCareer] = useState<Career | null>(() => loadCareer());
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [match, setMatch] = useState<MatchState | null>(null);
  const [finished, setFinished] = useState<MatchState | null>(null);

  // Every change to the career is written straight back, so a refresh mid-season
  // costs nothing.
  useEffect(() => {
    if (career) saveCareer(career);
  }, [career]);

  function start(managerName: string, clubId: string) {
    setCareer(createCareer(managerName, clubId));
    setScreen('dashboard');
  }

  function playMatch() {
    if (!career) return;
    const fixture = nextFixture(career);
    if (!fixture) return;
    setFinished(null);
    setMatch(
      createMatch({
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        userClubId: career.clubId,
        tactics: career.tactics,
      }),
    );
  }

  function finishMatch(state: MatchState) {
    if (!career) return;
    setCareer(completeFixture(career, summariseMatch(state)));
    setMatch(null);
    setFinished(state);
  }

  function updateTactics(tactics: Tactics) {
    if (!career) return;
    setCareer(setTactics(career, tactics));
  }

  function abandonCareer() {
    if (!window.confirm('Start again? This wipes your current season on this device.')) {
      return;
    }
    clearCareer();
    setCareer(null);
    setMatch(null);
    setFinished(null);
  }

  if (!career) {
    return (
      <Shell>
        <ClubSelect onStart={start} />
      </Shell>
    );
  }

  if (match) {
    return (
      <Shell>
        <MatchScreen initialState={match} onFinish={finishMatch} />
      </Shell>
    );
  }

  if (finished) {
    return (
      <Shell>
        <MatchResult state={finished} career={career} onDone={() => setFinished(null)} />
      </Shell>
    );
  }

  return (
    <Shell
      nav={
        <nav className="nav" aria-label="Main">
          <NavButton current={screen} value="dashboard" onSelect={setScreen}>
            Dashboard
          </NavButton>
          <NavButton current={screen} value="squad" onSelect={setScreen}>
            Squad
          </NavButton>
          <NavButton current={screen} value="tactics" onSelect={setScreen}>
            Tactics
          </NavButton>
          <button type="button" className="nav__item nav__item--danger" onClick={abandonCareer}>
            New career
          </button>
        </nav>
      }
    >
      {screen === 'dashboard' && <Dashboard career={career} onPlayMatch={playMatch} />}
      {screen === 'squad' && <SquadScreen clubId={career.clubId} />}
      {screen === 'tactics' && <TacticsScreen tactics={career.tactics} onChange={updateTactics} />}
    </Shell>
  );
}

function Shell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="app">
      {nav}
      <main className="app__main">{children}</main>
      <footer className="app__footer">
        <p>
          Football Dice — prototype. Fictional clubs and players. Every probability on
          screen is the real one the engine used.
        </p>
      </footer>
    </div>
  );
}

function NavButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Screen;
  value: Screen;
  onSelect: (screen: Screen) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`nav__item ${current === value ? 'is-active' : ''}`}
      aria-current={current === value ? 'page' : undefined}
      onClick={() => onSelect(value)}
    >
      {children}
    </button>
  );
}
