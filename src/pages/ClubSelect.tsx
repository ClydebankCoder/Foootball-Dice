import { useState } from 'react';
import { CLUBS } from '../data/clubs';
import { LEAGUES } from '../data/leagues';
import { getClubWithSquad } from '../data/world';
import type { CompetitionMode } from '../types';

interface Props {
  onStart: (managerName: string, clubId: string, competition: CompetitionMode) => void;
}

const COMPETITIONS: {
  value: CompetitionMode;
  label: string;
  note: string;
}[] = [
  {
    value: 'scottish-cup',
    label: 'Scottish Cup',
    note: 'Five or six ties, open draw, no second chances. Extra time and penalties if you need them. Short.',
  },
  {
    value: 'league',
    label: 'League season',
    note: 'A full division, home and away, promotion and relegation at the end of it. Long.',
  },
];

export function ClubSelect({ onStart }: Props) {
  const [managerName, setManagerName] = useState('');
  const [clubId, setClubId] = useState('greenock-morton');
  const [competition, setCompetition] = useState<CompetitionMode>('scottish-cup');

  return (
    <div className="stack">
      <section className="hero">
        <p className="hero__kicker">FOOTBALL DICE</p>
        <h1 className="hero__title">
          Every action has a number.
          <br />
          Then you roll for it.
        </h1>
        <p className="hero__body">
          You see the probability before you commit and the D100 after. A 91% pass and a
          17% through ball are both on the menu, always. Nothing is decided behind your
          back.
        </p>
      </section>

      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(managerName, clubId, competition);
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="manager-name">
            Your name
          </label>
          <input
            id="manager-name"
            className="field__input"
            value={managerName}
            onChange={(event) => setManagerName(event.target.value)}
            placeholder="The Gaffer"
            maxLength={40}
            autoComplete="name"
          />
          <p className="field__hint">
            No account needed — your career is saved on this device.
          </p>
        </div>

        <fieldset className="field">
          <legend className="field__label">What are you playing for?</legend>
          <div className="option-grid">
            {COMPETITIONS.map((option) => (
              <label
                key={option.value}
                className={`option ${option.value === competition ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="competition"
                  value={option.value}
                  checked={option.value === competition}
                  onChange={() => setCompetition(option.value)}
                  className="visually-hidden"
                />
                <span className="option__label">{option.label}</span>
                <span className="option__note">{option.note}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Choose your club</legend>
          <p className="field__hint field__hint--top">
            All 42 SPFL clubs. Start at the bottom and work up, or take a big job and try
            to keep it.
          </p>

          {LEAGUES.map((league) => (
            <div className="division" key={league.id}>
              <h2 className="division__name">{league.name}</h2>
              <div className="club-grid">
                {CLUBS.filter((club) => club.league === league.id).map((club) => {
                  const squad = getClubWithSquad(club.id);
                  const selected = club.id === clubId;
                  return (
                    <label
                      key={club.id}
                      className={`club-card ${selected ? 'is-selected' : ''}`}
                      style={{ borderLeftColor: club.primaryColour }}
                    >
                      <input
                        type="radio"
                        name="club"
                        value={club.id}
                        checked={selected}
                        onChange={() => setClubId(club.id)}
                        className="visually-hidden"
                      />
                      <span className="club-card__name">{club.name}</span>
                      <span className="club-card__stadium">{club.stadium}</span>
                      <span className="club-card__ratings">
                        <Rating label="ATT" value={squad.ratings.attack} />
                        <Rating label="MID" value={squad.ratings.midfield} />
                        <Rating label="DEF" value={squad.ratings.defence} />
                        <Rating label="GK" value={squad.ratings.goalkeeper} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>

        <button type="submit" className="btn btn--primary btn--block">
          Take the job
        </button>
      </form>
    </div>
  );
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <span className="rating">
      <span className="rating__label">{label}</span>
      <span className="rating__value">{value}</span>
    </span>
  );
}
