export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Creates a new lockout match.
 * 
 * @param {string} player1Id 
 * @param {number} minRating 
 * @param {number} maxRating 
 * @returns {Promise<Object>} The created match object.
 */
export async function createMatch(player1Id, minRating, maxRating, token) {
  const response = await fetch(`${API_BASE_URL}/api/matches/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ player1Id, minRating, maxRating }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create match');
  }

  return response.json();
}

/**
 * Joins an existing lockout match.
 * 
 * @param {string} player2Id 
 * @param {string} roomCode 
 * @returns {Promise<Object>} The updated match object.
 */
export async function joinMatch(player2Id, roomCode, token) {
  const response = await fetch(`${API_BASE_URL}/api/matches/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ player2Id, roomCode }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to join match');
  }

  return response.json();
}

/**
 * Fetches the current match status.
 * 
 * @param {string} matchId 
 * @returns {Promise<Object>} The match object.
 */
export async function getMatch(matchId) {
  const response = await fetch(`${API_BASE_URL}/api/matches/${matchId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch match details');
  }
  return response.json();
}

/**
 * Leaves or forfeits a lockout match.
 * 
 * @param {string} playerId 
 * @param {string} matchId 
 * @returns {Promise<Object>} The updated match or status result.
 */
export async function leaveMatch(playerId, matchId, token) {
  const response = await fetch(`${API_BASE_URL}/api/matches/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ playerId, matchId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to leave match');
  }

  return response.json();
}

/**
 * Starts a pending match (Host only).
 * 
 * @param {string} matchId 
 * @param {string} playerId 
 * @returns {Promise<Object>} The started match object.
 */
export async function startMatch(matchId, playerId, token) {
  const response = await fetch(`${API_BASE_URL}/api/matches/${matchId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ playerId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start match');
  }

  return response.json();
}

/**
 * Fetches any active match involving the current user.
 * 
 * @param {string} playerId 
 * @returns {Promise<Object|null>} The active match or null.
 */
export async function getActiveMatch(playerId) {
  const response = await fetch(`${API_BASE_URL}/api/matches/active?playerId=${playerId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch active session');
  }
  const data = await response.json();
  return data.match;
}

/**
 * Abandons an active lockout match and assigns the win to the other player.
 * 
 * @param {string} playerId 
 * @param {string} matchId 
 * @returns {Promise<Object>} The updated match.
 */
export async function abandonMatch(playerId, matchId, token) {
  const response = await fetch(`${API_BASE_URL}/api/matches/abandon`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ playerId, matchId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to abandon match');
  }

  return response.json();
}
