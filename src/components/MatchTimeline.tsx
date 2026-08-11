/**
 * The running commentary.
 *
 * Decisions keep their probability and roll attached, so the whole match can
 * be read back afterwards as a record of what the manager was told and what
 * the dice did about it.
 */

import type { MatchLogEntry } from '../types';

interface Props {
  log: MatchLogEntry[];
  limit?: number;
}

export function MatchTimeline({ log, limit }: Props) {
  const entries = limit ? log.slice(-limit) : log;

  return (
    <ol className="timeline">
      {[...entries].reverse().map((entry) => (
        <li className={`timeline__item timeline__item--${entry.kind}`} key={entry.id}>
          <span className="timeline__minute">{entry.minute}'</span>
          <span className="timeline__text">
            {entry.text}
            {entry.resolution && (
              <span className="timeline__roll">
                {entry.resolution.actionName} · {entry.resolution.probability}% · rolled{' '}
                {entry.resolution.roll}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
