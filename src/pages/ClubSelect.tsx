import { useState } from 'react';
import { LEAGUE_NAMES } from '../data/clubs';
import { getAllClubsWithSquads } from '../data/world';

interface Props {
  onStart: (managerName: string, clubId: string) => void;
}

export function ClubSelect({ onStart }: Props) {
  const clubs = getAllClubsWithSquads();
  const [managerName, setManagerName] = useState('');
  const [clubId, setClubId] = useState(clubs[0].id);

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
          onStart(managerName, clubId);
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
            No account needed — your career is saved on this device. Sign-in arrives with
            Supabase later.
          </p>
        </div>

        <fieldset className="field">
          <legend className="field__label">Choose your club</legend>
          <div className="club-grid">
            {clubs.map((club) => {
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
                  <span className="club-card__head">
                    <span className="club-card__name">{club.name}</span>
                    <span className="club-card__league">{LEAGUE_NAMES[club.league]}</span>
                  </span>
                  <span className="club-card__stadium">{club.stadium}</span>
                  <span className="club-card__ratings">
                    <Rating label="ATT" value={club.ratings.attack} />
                    <Rating label="MID" value={club.ratings.midfield} />
                    <Rating label="DEF" value={club.ratings.defence} />
                    <Rating label="GK" value={club.ratings.goalkeeper} />
                  </span>
                </label>
              );
            })}
          </div>
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
