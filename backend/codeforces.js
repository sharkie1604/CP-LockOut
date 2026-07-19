import axios from 'axios';

/**
 * Fetches problems from Codeforces and filters them by rating.
 * Randomly picks `count` problems and returns them with assigned lockout points (100, 200, 300, etc.).
 * 
 * @param {number} minRating 
 * @param {number} maxRating 
 * @param {number} count 
 * @returns {Promise<Array>}
 */
export async function fetchProblemsByRating(minRating, maxRating, count = 5) {
  try {
    const response = await axios.get('https://codeforces.com/api/problemset.problems');
    if (response.data.status !== 'OK') {
      throw new Error('Failed to retrieve problems from Codeforces API.');
    }

    const { problems } = response.data.result;

    // Filter problems strictly by rating boundaries
    const filteredProblems = problems.filter(
      (p) => p.rating !== undefined && p.rating >= minRating && p.rating <= maxRating
    );

    if (filteredProblems.length === 0) {
      throw new Error(`No problems found in rating range [${minRating}, ${maxRating}]`);
    }

    // Determine target size
    const actualCount = Math.min(count, filteredProblems.length);

    // Randomly select `actualCount` problems
    const selected = [];
    const tempPool = [...filteredProblems];
    for (let i = 0; i < actualCount; i++) {
      const randomIndex = Math.floor(Math.random() * tempPool.length);
      selected.push(tempPool.splice(randomIndex, 1)[0]);
    }

    // Sort selected problems ascending by rating to align with point values
    selected.sort((a, b) => a.rating - b.rating);

    // Map to required output format with lockout points sequence (100, 200, 300, 400, 500)
    return selected.map((p, idx) => ({
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
      points: (idx + 1) * 100,
    }));
  } catch (error) {
    console.error('Error fetching problems from Codeforces:', error.message);
    throw error;
  }
}
