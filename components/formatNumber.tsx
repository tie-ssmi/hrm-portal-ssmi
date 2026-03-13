export const NumberFormatter = {
  /** * Formats to: xxx,xxx,xxx.00 
   * Always shows 2 decimal places.
   */
  TwoZero: (value: number | string | null | undefined): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === null || num === undefined || isNaN(num)) return "0.00";

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  },

  /** * Formats to: xxx,xxx,xxx 
   * Removes all decimals.
   */
  NoZero: (value: number | string | null | undefined): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === null || num === undefined || isNaN(num)) return "0";

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(num);
  }
};