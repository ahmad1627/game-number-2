/**
 * Independent Fantasy XI ODI scoring preset v1
 * Pure, deterministic calculation of published site ODI Fantasy points.
 */

/**
 * Calculates fantasy points for a single player based on live match scorecard performance.
 * @param {Object} stats - Live performance data of the player
 * @param {string} role - Player role ('BAT' | 'WK' | 'ALL' | 'BOWL')
 * @returns {Object} { totalPoints, breakdown }
 */
function calculatePlayerPoints(stats = {}, role = "BAT") {
  let battingPoints = 0;
  let bowlingPoints = 0;
  let fieldingPoints = 0;
  let bonusPoints = 0;

  const breakdown = {
    playingXI: 0,
    runs: 0,
    boundaries: 0,
    milestones: 0,
    duckPenalty: 0,
    strikeRate: 0,
    wickets: 0,
    dismissalBonus: 0,
    wicketHauls: 0,
    maidens: 0,
    economyRate: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };

  // 1. Starting XI Bonus (+4 points for being in the announced XI)
  if (stats.isPlayingXI) {
    breakdown.playingXI = 4;
    bonusPoints += 4;
  }

  // ==========================================
  // 2. BATTING POINTS
  // ==========================================
  const runs = Number(stats.runs) || 0;
  const ballsFaced = Number(stats.ballsFaced) || 0;
  const fours = Number(stats.fours) || 0;
  const sixes = Number(stats.sixes) || 0;
  const isDismissed = Boolean(stats.isDismissed);

  // +1 per run
  breakdown.runs = runs * 1;
  battingPoints += breakdown.runs;

  // Boundary bonuses: +1 per four, +2 per six
  breakdown.boundaries = fours * 1 + sixes * 2;
  battingPoints += breakdown.boundaries;

  // Milestone bonuses: +4 for 50, +8 for 100
  if (runs >= 100) {
    breakdown.milestones = 8;
  } else if (runs >= 50) {
    breakdown.milestones = 4;
  }
  battingPoints += breakdown.milestones;

  // Duck penalty (-2 points for BAT, WK, ALL if dismissed with 0 runs)
  if (isDismissed && runs === 0 && ["BAT", "WK", "ALL"].includes(role)) {
    breakdown.duckPenalty = -2;
    battingPoints += breakdown.duckPenalty;
  }

  // Strike Rate bonus/penalty (Minimum 20 balls faced)
  if (ballsFaced >= 20 && role !== "BOWL") {
    const strikeRate = (runs / ballsFaced) * 100;
    if (strikeRate > 140) {
      breakdown.strikeRate = 6;
    } else if (strikeRate > 120) {
      breakdown.strikeRate = 4;
    } else if (strikeRate >= 100) {
      breakdown.strikeRate = 2;
    } else if (strikeRate >= 50 && strikeRate <= 60) {
      breakdown.strikeRate = -2;
    } else if (strikeRate >= 40 && strikeRate < 50) {
      breakdown.strikeRate = -4;
    } else if (strikeRate < 40) {
      breakdown.strikeRate = -6;
    }
    battingPoints += breakdown.strikeRate;
  }

  // ==========================================
  // 3. BOWLING POINTS
  // ==========================================
  const wickets = Number(stats.wickets) || 0;
  const lbwBowledCount = Number(stats.lbwBowledCount) || 0;
  const maidenOvers = Number(stats.maidenOvers) || 0;
  const oversBowled = (Number(stats.ballsBowled) || 0) / 6; // balls are integers, never cricket decimal overs
  const runsConceded = Number(stats.runsConceded) || 0;

  // +25 per wicket (excluding run-outs)
  breakdown.wickets = wickets * 25;
  bowlingPoints += breakdown.wickets;

  // +8 bonus for Bowled/LBW dismissal
  breakdown.dismissalBonus = lbwBowledCount * 8;
  bowlingPoints += breakdown.dismissalBonus;

  // Wicket haul bonuses: +4 for 4W, +8 for 5W
  if (wickets >= 5) {
    breakdown.wicketHauls = 8;
  } else if (wickets === 4) {
    breakdown.wicketHauls = 4;
  }
  bowlingPoints += breakdown.wicketHauls;

  // +4 per maiden over
  breakdown.maidens = maidenOvers * 4;
  bowlingPoints += breakdown.maidens;

  // Economy Rate bonus/penalty (Minimum 5 overs bowled)
  if (oversBowled >= 5.0) {
    const economyRate = runsConceded / oversBowled;
    if (economyRate < 3.5) {
      breakdown.economyRate = 6;
    } else if (economyRate < 4.5) {
      breakdown.economyRate = 4;
    } else if (economyRate <= 5.5) {
      breakdown.economyRate = 2;
    } else if (economyRate > 7 && economyRate <= 8.0) {
      breakdown.economyRate = -2;
    } else if (economyRate > 8.0 && economyRate <= 9.0) {
      breakdown.economyRate = -4;
    } else if (economyRate > 9.0) {
      breakdown.economyRate = -6;
    }
    bowlingPoints += breakdown.economyRate;
  }

  // ==========================================
  // 4. FIELDING POINTS
  // ==========================================
  const catches = Number(stats.catches) || 0;
  const stumpings = Number(stats.stumpings) || 0;
  const runOutDirect = Number(stats.runOutDirect) || 0;
  const runOutIndirect = Number(stats.runOutIndirect) || 0;

  // +8 per catch; +4 bonus for 3 or more catches
  let catchPoints = catches * 8;
  if (catches >= 3) {
    catchPoints += 4;
  }
  breakdown.catches = catchPoints;
  fieldingPoints += breakdown.catches;

  // +12 per stumping
  breakdown.stumpings = stumpings * 12;
  fieldingPoints += breakdown.stumpings;

  // Run-outs: +12 direct hit, +6 indirect (catcher/thrower combo)
  breakdown.runOuts = runOutDirect * 12 + runOutIndirect * 6;
  fieldingPoints += breakdown.runOuts;

  const totalPoints =
    battingPoints + bowlingPoints + fieldingPoints + bonusPoints;

  return {
    totalPoints,
    breakdown: {
      batting: battingPoints,
      bowling: bowlingPoints,
      fielding: fieldingPoints,
      bonus: bonusPoints,
      details: breakdown,
    },
  };
}

/**
 * Calculates total points for a UserTeam, applying Captain (2x) and Vice-Captain (1.5x) multipliers.
 * @param {Object} userTeam - The UserTeam document/object
 * @param {Object} playerPointsMap - Dictionary of { [playerId]: pointsNumber }
 * @returns {number} Total multiplied points for the user fantasy squad
 */
function calculateUserTeamPoints(userTeam, playerPointsMap = {}) {
  if (!userTeam || !Array.isArray(userTeam.players)) {
    return 0;
  }

  const captainIdStr = userTeam.captainId?.toString();
  const viceCaptainIdStr = userTeam.viceCaptainId?.toString();

  let teamTotal = 0;

  for (const playerRef of userTeam.players) {
    const pIdStr = (playerRef._id || playerRef).toString();
    const basePoints = Number(playerPointsMap[pIdStr]) || 0;

    if (pIdStr === captainIdStr) {
      teamTotal += basePoints * 2.0; // 2x multiplier
    } else if (pIdStr === viceCaptainIdStr) {
      teamTotal += basePoints * 1.5; // 1.5x multiplier
    } else {
      teamTotal += basePoints;
    }
  }

  return Number(teamTotal.toFixed(1));
}

module.exports = {
  calculatePlayerPoints,
  calculateUserTeamPoints,
};
