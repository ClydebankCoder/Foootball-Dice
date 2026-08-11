import { useState } from 'react';
import { getClubWithSquad } from '../data/world';
import {
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  type AttributeKey,
  type Player,
} from '../types';

interface Props {
  clubId: string;
}

const ATTRIBUTE_NAMES: Record<AttributeKey, string> = {
  pace: 'Pace',
  shooting: 'Shooting',
  passing: 'Passing',
  vision: 'Vision',
  technique: 'Technique',
  strength: 'Strength',
  defending: 'Defending',
  positioning: 'Positioning',
  composure: 'Composure',
  stamina: 'Stamina',
  flair: 'Flair',
  reflexes: 'Reflexes',
  handling: 'Handling',
  distribution: 'Distribution',
  oneOnOnes: 'One-on-ones',
};

const POSITION_ORDER: Player['position'][] = ['GK', 'DEF', 'MID', 'ATT'];

export function SquadScreen({ clubId }: Props) {
  const club = getClubWithSquad(clubId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = club.players.find((p) => p.id === selectedId) ?? null;

  const squad = [...club.players].sort(
    (a, b) =>
      POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) ||
      b.overall - a.overall,
  );

  return (
    <div className="stack">
      <section className="card">
        <h1 className="card__title">{club.name} squad</h1>
        <p className="muted">
          Attack {club.ratings.attack} · Midfield {club.ratings.midfield} · Defence{' '}
          {club.ratings.defence} · Goalkeeping {club.ratings.goalkeeper}
        </p>

        <div className="table-wrap">
          <table className="squad-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Pos</th>
                <th scope="col">Age</th>
                <th scope="col">Ovr</th>
                <th scope="col">Fit</th>
                <th scope="col"><span className="visually-hidden">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {squad.map((player) => (
                <tr
                  key={player.id}
                  className={player.id === selectedId ? 'is-selected' : undefined}
                >
                  <td>{player.squadNumber}</td>
                  <th scope="row">{player.name}</th>
                  <td>
                    <span className={`pos pos--${player.position.toLowerCase()}`}>
                      {player.position}
                    </span>
                  </td>
                  <td>{player.age}</td>
                  <td className="squad-table__overall">{player.overall}</td>
                  <td>{player.fitness}%</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      aria-expanded={player.id === selectedId}
                      onClick={() =>
                        setSelectedId(player.id === selectedId ? null : player.id)
                      }
                    >
                      {player.id === selectedId ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && <PlayerDetail player={selected} />}
    </div>
  );
}

function PlayerDetail({ player }: { player: Player }) {
  const keys: readonly AttributeKey[] =
    player.position === 'GK' ? GOALKEEPER_ATTRIBUTES : OUTFIELD_ATTRIBUTES;

  return (
    <section className="card">
      <h2 className="card__title">{player.name}</h2>
      <p className="muted">
        {player.position} · Age {player.age} · Overall {player.overall} · Fitness{' '}
        {player.fitness}%
      </p>
      <ul className="attributes">
        {keys.map((key) => {
          const value = player.attributes[key];
          return (
            <li className="attribute" key={key}>
              <span className="attribute__name">{ATTRIBUTE_NAMES[key]}</span>
              <span className="attribute__meter" aria-hidden="true">
                <span className="attribute__fill" style={{ width: `${value}%` }} />
              </span>
              <span className="attribute__value">{value}</span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        These are the numbers the probability engine reads. A better passer genuinely
        makes a through ball more likely — check the “Why?” panel mid-match.
      </p>
    </section>
  );
}
