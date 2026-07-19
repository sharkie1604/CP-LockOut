/**
 * Calculates new ratings for two players using the standard Elo rating algorithm.
 * 
 * @param {number} player1Rating - Current rating of Player 1
 * @param {number} player2Rating - Current rating of Player 2
 * @param {number} outcome - 1 if Player 1 wins, 0 if Player 2 wins, 0.5 if it is a tie
 * @param {number} kFactor - The K-factor scaling (defaults to 32)
 * @returns {Object} { newPlayer1Rating, newPlayer2Rating }
 */
export function calculateNewRatings(player1Rating, player2Rating, outcome, kFactor = 32) {
  // Calculate expected scores
  const expected1 = 1 / (1 + Math.pow(10, (player2Rating - player1Rating) / 400));
  const expected2 = 1 / (1 + Math.pow(10, (player1Rating - player2Rating) / 400));

  // Determine actual outcomes
  const outcome1 = outcome;
  const outcome2 = 1 - outcome;

  // Compute new ratings
  const newPlayer1Rating = Math.round(player1Rating + kFactor * (outcome1 - expected1));
  const newPlayer2Rating = Math.round(player2Rating + kFactor * (outcome2 - expected2));

  return { newPlayer1Rating, newPlayer2Rating };
}
