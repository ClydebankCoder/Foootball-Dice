import type { Mentality, PassingStyle, Pressing, Tactics, Tempo } from '../types';

interface Props {
  tactics: Tactics;
  onChange: (tactics: Tactics) => void;
}

const MENTALITIES: { value: Mentality; label: string; note: string }[] = [
  { value: 'defensive', label: 'Defensive', note: 'Safer on the ball, better in the block.' },
  { value: 'balanced', label: 'Balanced', note: 'No thumb on the scale either way.' },
  { value: 'attacking', label: 'Attacking', note: 'Riskier actions get a nudge upwards.' },
  { value: 'very-attacking', label: 'Very Attacking', note: 'Gambles improve, safe play suffers.' },
];

const PASSING: { value: PassingStyle; label: string; note: string }[] = [
  { value: 'short', label: 'Short', note: 'Suits short passes and layoffs.' },
  { value: 'mixed', label: 'Mixed', note: 'No preference.' },
  { value: 'direct', label: 'Direct', note: 'Suits long passes, switches and crosses.' },
];

const TEMPO: { value: Tempo; label: string; note: string }[] = [
  { value: 'slow', label: 'Slow', note: 'More time on the ball: +2% to attacking actions.' },
  { value: 'normal', label: 'Normal', note: 'No modifier.' },
  { value: 'fast', label: 'Fast', note: 'Rushed: −2% to attacking actions.' },
];

const PRESSING: { value: Pressing; label: string; note: string }[] = [
  { value: 'low', label: 'Low', note: 'Sit in: −2% to defensive actions.' },
  { value: 'medium', label: 'Medium', note: 'No modifier.' },
  { value: 'high', label: 'High', note: 'Aggressive: +3% to defensive actions.' },
];

export function TacticsScreen({ tactics, onChange }: Props) {
  return (
    <div className="stack">
      <section className="card">
        <h1 className="card__title">Tactics</h1>
        <p className="muted">
          Four settings, and each one shows up by name in the probability breakdown during
          a match. Nothing here is hidden from you.
        </p>
      </section>

      <Group
        title="Mentality"
        options={MENTALITIES}
        current={tactics.mentality}
        onSelect={(value) => onChange({ ...tactics, mentality: value })}
      />
      <Group
        title="Passing"
        options={PASSING}
        current={tactics.passing}
        onSelect={(value) => onChange({ ...tactics, passing: value })}
      />
      <Group
        title="Tempo"
        options={TEMPO}
        current={tactics.tempo}
        onSelect={(value) => onChange({ ...tactics, tempo: value })}
      />
      <Group
        title="Pressing"
        options={PRESSING}
        current={tactics.pressing}
        onSelect={(value) => onChange({ ...tactics, pressing: value })}
      />
    </div>
  );
}

interface GroupProps<T extends string> {
  title: string;
  options: { value: T; label: string; note: string }[];
  current: T;
  onSelect: (value: T) => void;
}

function Group<T extends string>({ title, options, current, onSelect }: GroupProps<T>) {
  return (
    <section className="card">
      <fieldset>
        <legend className="card__title">{title}</legend>
        <div className="option-grid">
          {options.map((option) => (
            <label
              key={option.value}
              className={`option ${option.value === current ? 'is-selected' : ''}`}
            >
              <input
                type="radio"
                name={title}
                value={option.value}
                checked={option.value === current}
                onChange={() => onSelect(option.value)}
                className="visually-hidden"
              />
              <span className="option__label">{option.label}</span>
              <span className="option__note">{option.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
