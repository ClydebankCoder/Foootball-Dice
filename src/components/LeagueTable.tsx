import { getClub } from '../data/clubs';
import type { TableRow } from '../types';

interface Props {
  rows: TableRow[];
  highlightClubId?: string;
  /** Club ids going up, marked with a green edge. */
  promoted?: string[];
  /** Club ids going down, marked with a red edge. */
  relegated?: string[];
}

export function LeagueTable({
  rows,
  highlightClubId,
  promoted = [],
  relegated = [],
}: Props) {
  return (
    <div className="table-wrap">
      <table className="league-table">
        <caption className="visually-hidden">League table</caption>
        <thead>
          <tr>
            <th scope="col" className="league-table__pos">#</th>
            <th scope="col">Club</th>
            <th scope="col">P</th>
            <th scope="col">W</th>
            <th scope="col">D</th>
            <th scope="col">L</th>
            <th scope="col" className="league-table__wide">GF</th>
            <th scope="col" className="league-table__wide">GA</th>
            <th scope="col">GD</th>
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const club = getClub(row.clubId);
            const movement = promoted.includes(row.clubId)
              ? 'is-promoted'
              : relegated.includes(row.clubId)
                ? 'is-relegated'
                : '';
            return (
              <tr
                key={row.clubId}
                className={
                  `${row.clubId === highlightClubId ? 'is-you' : ''} ${movement}`.trim() ||
                  undefined
                }
              >
                <td className="league-table__pos">{index + 1}</td>
                <th scope="row">
                  <span className="league-table__club">
                    <span className="dot" style={{ background: club.primaryColour }} />
                    <span className="league-table__full">{club.name}</span>
                    <span className="league-table__abbr">{club.abbreviation}</span>
                  </span>
                </th>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.drawn}</td>
                <td>{row.lost}</td>
                <td className="league-table__wide">{row.goalsFor}</td>
                <td className="league-table__wide">{row.goalsAgainst}</td>
                <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className="league-table__pts">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
