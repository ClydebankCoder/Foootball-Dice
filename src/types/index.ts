/**
 * Shared domain types.
 *
 * These deliberately mirror the shape of the eventual Supabase tables (see
 * `supabase/schema.sql`) so that swapping the local fixture data for real
 * Scottish clubs and players is a data change, not a rewrite.
 */

/* ---------------------------------------------------------------- players */

export const OUTFIELD_ATTRIBUTES = [
  'pace',
  'shooting',
  'passing',
  'vision',
  'technique',
  'strength',
  'defending',
  'positioning',
  'composure',
  'stamina',
  'flair',
] as const;

export const GOALKEEPER_ATTRIBUTES = [
  'reflexes',
  'handling',
  'positioning',
  'distribution',
  'oneOnOnes',
  'composure',
] as const;

export type OutfieldAttribute = (typeof OUTFIELD_ATTRIBUTES)[number];
export type GoalkeeperAttribute = (typeof GOALKEEPER_ATTRIBUTES)[number];
export type AttributeKey = OutfieldAttribute | GoalkeeperAttribute;

/** Every attribute is rated 1–100. */
export type Attributes = Record<AttributeKey, number>;

export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface Player {
  id: string;
  clubId: string;
  name: string;
  age: number;
  position: Position;
  /** Shirt number — cosmetic, but it makes the squad screen read like a team. */
  squadNumber: number;
  attributes: Attributes;
  /** Derived 1–100 summary of the attributes that matter for the position. */
  overall: number;
  /** Match sharpness, 0–100. Drives the fatigue modifier. */
  fitness: number;
}

/* ------------------------------------------------------------------ clubs */

export type LeagueId =
  | 'premiership'
  | 'championship'
  | 'league-one'
  | 'league-two';

export interface ClubRatings {
  attack: number;
  midfield: number;
  defence: number;
  goalkeeper: number;
  overall: number;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  /** Three-letter code used in compact table/scoreboard layouts. */
  abbreviation: string;
  stadium: string;
  league: LeagueId;
  primaryColour: string;
  secondaryColour: string;
  /** Target profile used to generate the squad. Real data can replace this. */
  profile: {
    attack: number;
    midfield: number;
    defence: number;
    goalkeeper: number;
  };
}

/** A club with its squad and the ratings derived from that squad. */
export interface ClubWithSquad extends Club {
  players: Player[];
  ratings: ClubRatings;
}

/* ---------------------------------------------------------------- tactics */

export type Mentality = 'defensive' | 'balanced' | 'attacking' | 'very-attacking';
export type PassingStyle = 'short' | 'mixed' | 'direct';
export type Tempo = 'slow' | 'normal' | 'fast';
export type Pressing = 'low' | 'medium' | 'high';

export interface Tactics {
  mentality: Mentality;
  passing: PassingStyle;
  tempo: Tempo;
  pressing: Pressing;
}

/* ---------------------------------------------------------------- actions */

export type ActionCategory =
  | 'pass'
  | 'dribble'
  | 'shot'
  | 'cross'
  | 'defend'
  | 'keep';

export type RiskLevel = 'safe' | 'balanced' | 'risky' | 'extreme';

export type SituationId =
  // attacking
  | 'build-up'
  | 'counter-attack'
  | 'final-third'
  | 'one-on-one'
  | 'wing-attack'
  | 'box-chance'
  // defending
  | 'opposition-counter'
  | 'defend-through-ball'
  | 'defend-cross'
  | 'defend-one-on-one';

export type SituationSide = 'attack' | 'defence';

/**
 * What a successful action leads to. The match engine uses this to chain
 * decisions together, so a goal is the end of a sequence the manager built.
 */
export type ActionIntent =
  /** Keeps the ball; the sequence stays put unless `next` says otherwise. */
  | { kind: 'retain'; next?: SituationId }
  /** Moves the sequence into a more dangerous situation. */
  | { kind: 'advance'; next: SituationId }
  /** A shot: success is a goal, a near miss is a save/scramble. */
  | { kind: 'shot' }
  /** Defensive: success ends the opposition attack. */
  | { kind: 'stop' }
  /** Defensive: success survives this phase but the attack continues. */
  | { kind: 'delay'; next: SituationId };

export interface MatchAction {
  id: string;
  name: string;
  category: ActionCategory;
  /** Situations in which this action is offered. */
  situations: SituationId[];
  /** Starting point before any modifier, in percentage points. */
  baseProbability: number;
  /**
   * Attributes that help, with a weight in "percentage points gained per 10
   * rating points above average (50)". A weight of 3 with a rating of 80 is
   * therefore +9%.
   */
  attributeWeights: Partial<Record<AttributeKey, number>>;
  /** Opposition team ratings that resist this action, same weighting scale. */
  opposedBy: Partial<Record<keyof ClubRatings, number>>;
  riskLevel: RiskLevel;
  /** What success leads to by default. */
  intent: ActionIntent;
  /**
   * Per-situation override. "Force wide" ends a one-on-one but only buys time
   * against a counter, and this keeps that as one action rather than two.
   */
  intentBySituation?: Partial<Record<SituationId, ActionIntent>>;
  /** Short line shown under the action name. */
  blurb: string;
  /** Preferred tactical settings; matching them is worth a few points. */
  suits?: Partial<Tactics>;
  /** Stops the attack by giving away a free kick, with a booking risk. */
  commitsFoul?: boolean;
}

/* ------------------------------------------------------ probability model */

export interface ProbabilityFactor {
  label: string;
  /** Signed percentage points. */
  value: number;
}

export interface ProbabilityBreakdown {
  base: number;
  factors: ProbabilityFactor[];
  /** Sum of base + factors before clamping. */
  raw: number;
  /** Final probability, clamped to [MIN_PROBABILITY, MAX_PROBABILITY]. */
  final: number;
  clamped: boolean;
}

/* --------------------------------------------------------- dice & results */

export type OutcomeBand =
  | 'critical-success'
  | 'success'
  | 'partial-success'
  | 'failure'
  | 'critical-failure';

export interface Resolution {
  actionId: string;
  actionName: string;
  probability: number;
  breakdown: ProbabilityBreakdown;
  /** 1–100. */
  roll: number;
  band: OutcomeBand;
  /** True when roll <= probability. Bands never contradict this. */
  success: boolean;
  /** Football description of what happened. */
  commentary: string;
}

/* ------------------------------------------------------------ match model */

export interface SituationDefinition {
  id: SituationId;
  side: SituationSide;
  title: string;
  /** Narrative lines; one is chosen at random per event. */
  descriptions: string[];
  /** Difficulty of the moment, applied as a negative modifier. */
  pressure: number;
  /** Which squad position tends to be on the ball / defending here. */
  actorPositions: Position[];
}

export interface MatchEvent {
  id: string;
  minute: number;
  situation: SituationId;
  side: SituationSide;
  /** Team in possession. */
  possessionTeamId: string;
  /** The user's player at the centre of the moment. */
  actorId: string;
  /** Opposition player referenced by commentary. */
  opponentId: string;
  narrative: string;
  /** Sequence number — decisions 1..n within one possession. */
  sequenceStep: number;
}

export type LogKind =
  | 'info'
  | 'goal'
  | 'conceded'
  | 'chance'
  | 'save'
  | 'decision'
  | 'period';

export interface MatchLogEntry {
  id: string;
  minute: number;
  kind: LogKind;
  text: string;
  /** Present when the entry came from a user decision. */
  resolution?: Resolution;
}

export interface TeamMatchStats {
  shots: number;
  shotsOnTarget: number;
  possession: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface DecisionRecord {
  minute: number;
  situation: SituationId;
  side: SituationSide;
  actionId: string;
  actionName: string;
  riskLevel: RiskLevel;
  probability: number;
  roll: number;
  band: OutcomeBand;
  success: boolean;
  /** True when this decision directly produced a goal. */
  ledToGoal: boolean;
}

export type MatchPhase =
  | 'kick-off'
  | 'decision'
  | 'resolved'
  /** Level after ninety in a tie that needs a winner. */
  | 'extra-time'
  /** Level after extra time. */
  | 'shootout'
  | 'full-time';

export interface GoalRecord {
  minute: number;
  teamId: string;
  scorerId: string;
  scorerName: string;
  /** Probability of the action that scored it, when it came from a decision. */
  probability?: number;
  roll?: number;
}

export interface MatchState {
  id: string;
  seed: number;
  fixtureId: string;
  homeClubId: string;
  awayClubId: string;
  userClubId: string;
  /** The manager's settings for this match. */
  tactics: Tactics;
  minute: number;
  homeScore: number;
  awayScore: number;
  phase: MatchPhase;
  stats: { home: TeamMatchStats; away: TeamMatchStats };
  log: MatchLogEntry[];
  decisions: DecisionRecord[];
  goals: GoalRecord[];
  currentEvent: MatchEvent | null;
  /** Resolution awaiting acknowledgement while phase is 'resolved'. */
  lastResolution: Resolution | null;
  /**
   * Cup ties cannot end level: at ninety they go to extra time, and at 120 to
   * penalties. League fixtures simply end.
   */
  mustHaveWinner: boolean;
  /** 90 normally, 120 once extra time has started. */
  endMinute: number;
  /** Set when a tie has gone all the way to penalties. */
  shootout: ShootoutState | null;
  /** How many random draws have been consumed, so the match stays replayable. */
  rngCursor: number;
  /** Minutes at which the manager is asked to decide. */
  decisionMinutes: number[];
  /**
   * Roughly how many decisions this match should ask for in total. A passage
   * of play can run to several decisions, so the budget — not the schedule —
   * is what keeps a match to a sitting.
   */
  decisionBudget: number;
  /** How many scheduled decision moments have been started. */
  momentsStarted: number;
  /** Set while a possession sequence is still running. */
  pendingSituation: SituationId | null;
  sequenceStep: number;
  /**
   * A modifier earned by the previous decision in this passage of play — a
   * critical success leaves the defence scrambling, a critical failure leaves
   * you out of position. It applies to the next decision only, and appears in
   * that decision's breakdown by name like every other modifier.
   */
  carriedAdvantage: ProbabilityFactor | null;
}

/* ----------------------------------------------------------- league/career */

export interface Fixture {
  id: string;
  round: number;
  homeClubId: string;
  awayClubId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface ManagerRecords {
  /** Lowest probability the manager has ever succeeded with. */
  lowestSuccessfulProbability: number | null;
  lowestSuccessfulActionName: string | null;
  actionsAttempted: number;
  actionsSuccessful: number;
}

/* -------------------------------------------------------------- cup */

/** Which competition a career is playing. */
export type CompetitionMode = 'league' | 'scottish-cup';

export interface CupTie {
  id: string;
  round: number;
  homeClubId: string;
  awayClubId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Penalty scores, when the tie could not be settled in 120 minutes. */
  shootout: { home: number; away: number } | null;
  /** Set once the tie is settled. */
  winnerClubId: string | null;
  played: boolean;
}

export interface CupState {
  season: number;
  /** Index into CUP_ROUNDS. */
  round: number;
  /** Every tie drawn so far, across every round. */
  ties: CupTie[];
  /** Clubs still in the hat for the current round. */
  remaining: string[];
  /** Set when the cup has been won. */
  winnerClubId: string | null;
  /** The round in which the manager's club went out, if it has. */
  eliminatedInRound: number | null;
}

/* ----------------------------------------------------------- shootout */

export type ShootoutRole = 'taking' | 'saving';
export type PenaltyDirection = 'left' | 'centre' | 'right';

export interface ShootoutKick {
  /** The club taking the kick. */
  clubId: string;
  /** Always the taker, never the goalkeeper. */
  playerName: string;
  /** Whether the manager was taking this kick or trying to keep it out. */
  role: ShootoutRole;
  /** The manager's chosen action — a finish, or a dive. */
  actionName: string;
  probability: number;
  roll: number;
  scored: boolean;
  commentary: string;
  /** True when the manager chose this kick rather than it being simulated. */
  userDecision: boolean;
}

export interface ShootoutState {
  homeClubId: string;
  awayClubId: string;
  userClubId: string;
  homeScore: number;
  awayScore: number;
  kicks: ShootoutKick[];
  /** Club taking the next kick. */
  turnClubId: string;
  /** 1-5, then sudden death. */
  kickNumber: number;
  suddenDeath: boolean;
  complete: boolean;
  winnerClubId: string | null;
  /**
   * The visible read on the next opposition penalty. Shown to the manager
   * before they choose how to dive, so the decision is informed rather than
   * a coin flip they cannot see into — and the numbers on the diving options
   * already account for it being a bluff.
   */
  tell: { direction: PenaltyDirection; text: string } | null;
  seed: number;
  rngCursor: number;
}

/** How a club's season ended, once the final table was settled. */
export type SeasonOutcome =
  | 'champion'
  | 'promoted'
  | 'relegated'
  | 'none';

export interface SeasonRecord {
  season: number;
  league: LeagueId;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  outcome: SeasonOutcome;
}

/** One division's promotion/relegation result at the end of a season. */
export interface DivisionResult {
  league: LeagueId;
  table: TableRow[];
  promoted: string[];
  relegated: string[];
}

/** One completed cup run. */
export interface CupSeasonRecord {
  season: number;
  /** The round the manager's club went out in, or the final if they won it. */
  roundReached: number;
  won: boolean;
  runnerUp: boolean;
}

export interface SeasonSummary {
  season: number;
  /** The division the manager competed in. */
  league: LeagueId;
  divisions: DivisionResult[];
  managerRecord: SeasonRecord;
  /** Where the manager's club will play next season. */
  nextLeague: LeagueId;
}

export interface Career {
  version: number;
  managerName: string;
  clubId: string;
  /** League season or Scottish Cup. Chosen when the job is taken. */
  competition: CompetitionMode;
  /** The how-it-works briefing is shown once, when the job is taken. */
  tutorialSeen: boolean;
  tactics: Tactics;
  /** 1 for the first season, incrementing on each rollover. */
  season: number;
  /** Which clubs are in which division *this* season. Clubs move. */
  divisions: Record<LeagueId, string[]>;
  /** Fixtures for the manager's division this season only. */
  fixtures: Fixture[];
  records: ManagerRecords;
  /** Result summaries for recent matches, newest last. */
  history: MatchSummary[];
  /** One row per completed season. League mode only. */
  seasons: SeasonRecord[];
  /** Set when a season has ended and is waiting to be reviewed. */
  pendingSeasonSummary: SeasonSummary | null;
  /** The cup run in progress. Cup mode only. */
  cup: CupState | null;
  /** One row per completed cup run. */
  cupSeasons: CupSeasonRecord[];
}

export interface MatchSummary {
  fixtureId: string;
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  goals: GoalRecord[];
  stats: { home: TeamMatchStats; away: TeamMatchStats };
  decisions: DecisionRecord[];
}
