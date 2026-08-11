import { getClub } from '../data/clubs';
import type { TableRow } from '../types';

interface Props {
  rows: TableRow[];
  highlightClubId?: string;
}

export function LeagueTable({ rows, highlightClubId }: Props) {
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
            <th scope="col">GF</th>
            <th scope="col">GA</th>
            <th scope="col">GD</th>
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const club = getClub(row.clubId);
            return (
              <tr
                key={row.clubId}
                className={row.clubId === highlightClubId ? 'is-you' : undefined}
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
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
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
