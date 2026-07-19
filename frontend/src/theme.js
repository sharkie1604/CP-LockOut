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
    return { name: 'Script Kiddie', colorHex: '#9E9E9E', tailwindTextClass: 'text-[#9E9E9E]' };
  }
  
  if (rating < 1200) {
    return { name: 'Script Kiddie', colorHex: '#9E9E9E', tailwindTextClass: 'text-[#9E9E9E]' };
  } else if (rating < 1400) {
    return { name: 'Debugger', colorHex: '#4CAF50', tailwindTextClass: 'text-[#4CAF50]' };
  } else if (rating < 1600) {
    return { name: 'Stack Overlord', colorHex: '#00BCD4', tailwindTextClass: 'text-[#00BCD4]' };
  } else if (rating < 1900) {
    return { name: 'Core Engineer', colorHex: '#2196F3', tailwindTextClass: 'text-[#2196F3]' };
  } else if (rating < 2200) {
    return { name: 'System Architect', colorHex: '#9C27B0', tailwindTextClass: 'text-[#9C27B0]' };
  } else {
    return { name: 'Kernel Master', colorHex: '#FF5722', tailwindTextClass: 'text-[#FF5722]' };
  }
}
