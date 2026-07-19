// Theme Design Constants (Strict 1px Borders, Zero Shadows, Sharp Layouts)
export const theme = {
  colors: {
    canvasBase: '#09090B',
    cardSurface: '#18181B',
    borderMuted: '#27272A',
    
    // Game State Accents
    active: '#06B6D4', // Electric Cyan
    locked: '#EF4444', // Crimson Red
    solved: '#10B981', // Emerald Green
  },
};

/**
 * Resolves Developer Stack Hierarchy tier properties by Codeforces rating.
 * 
 * @param {number} rating 
 * @returns {Object} { name, colorHex, tailwindTextClass }
 */
export function getDeveloperTier(rating) {
  if (rating === undefined || rating === null) {
    return { name: 'Script Kiddie', colorHex: '#94A3B8', tailwindTextClass: 'text-slate-400' };
  }
  
  if (rating < 1200) {
    return { name: 'Script Kiddie', colorHex: '#94A3B8', tailwindTextClass: 'text-slate-400' };
  } else if (rating < 1400) {
    return { name: 'Debugger', colorHex: '#22C55E', tailwindTextClass: 'text-green-500' };
  } else if (rating < 1600) {
    return { name: 'Stack Overlord', colorHex: '#06B6D4', tailwindTextClass: 'text-cyan-500' };
  } else if (rating < 1900) {
    return { name: 'Core Engineer', colorHex: '#3B82F6', tailwindTextClass: 'text-blue-500' };
  } else if (rating < 2200) {
    return { name: 'System Architect', colorHex: '#A855F7', tailwindTextClass: 'text-purple-500' };
  } else {
    return { name: 'Kernel Master', colorHex: '#EF4444', tailwindTextClass: 'text-red-500' };
  }
}
