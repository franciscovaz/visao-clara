/**
 * Date utilities for consistent date handling across the app
 * Single source of truth: DD-MM-YYYY format
 */

// Format a date for display (Portuguese format)
export const formatDate = (dateString: string): string => {
  if (!dateString) return '—';
  
  // For now, just return the date as-is to see what we're getting
  return dateString;
};

// Format a date for storage (always DD-MM-YYYY)
export const formatDateForStorage = (dateString: string): string => {
  if (!dateString) return '';
  
  // If it's already in DD-MM-YYYY format, return as-is
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    return dateString;
  }
  
  // Handle DD/MM/YYYY format - convert to DD-MM-YYYY
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
    }
  }
  
  // Handle YYYY-MM-DD format - convert to DD-MM-YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  }
  
  // Fallback: try to create a date and format it
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
  
  return dateString; // Return original if can't parse
};

// Sort dates consistently (handles all formats)
export const sortDatesDescending = (a: string, b: string): number => {
  // Convert both dates to Date objects for comparison
  const parseDate = (dateString: string): Date => {
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return new Date(`${year}-${month}-${day}`);
      }
    } else if (dateString.includes('-')) {
      // Check if it's DD-MM-YYYY or YYYY-MM-DD
      const parts = dateString.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return new Date(dateString);
        } else {
          // DD-MM-YYYY
          const [day, month, year] = parts;
          return new Date(`${year}-${month}-${day}`);
        }
      }
    }
    return new Date(dateString);
  };
  
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  
  if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
  if (isNaN(dateA.getTime())) return 1;
  if (isNaN(dateB.getTime())) return -1;
  
  return dateB.getTime() - dateA.getTime();
};
