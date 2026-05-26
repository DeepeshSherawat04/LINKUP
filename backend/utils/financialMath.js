/**
 * Financial Math Utility
 * Production rule: All internal calculations use integer cents.
 * $1.00 = 100 cents. Eliminates IEEE-754 floating-point errors.
 */

const FinancialMath = {
  toCents(dollars) {
    if (dollars === null || dollars === undefined || dollars === '') return 0;
    const val = typeof dollars === 'string' ? parseFloat(dollars.replace(/[^0-9.-]/g, '')) : parseFloat(dollars);
    if (Number.isNaN(val)) return 0;
    return Math.round(val * 100);
  },

  toDollars(cents) {
    if (!Number.isFinite(cents)) return '0.00';
    return (cents / 100).toFixed(2);
  },

  add(a, b) {
    return (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
  },

  subtract(a, b) {
    return (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0);
  },

  multiply(a, b) {
    return Math.round((Number.isFinite(a) ? a : 0) * (Number.isFinite(b) ? b : 0));
  },

  divide(a, b) {
    const denom = Number.isFinite(b) ? b : 0;
    if (denom === 0) return 0;
    return Math.round((Number.isFinite(a) ? a : 0) / denom);
  },

  monthlyFromAnnual(annualCents) {
    return Math.round((Number.isFinite(annualCents) ? annualCents : 0) / 12);
  },

  annualFromMonthly(monthlyCents) {
    return (Number.isFinite(monthlyCents) ? monthlyCents : 0) * 12;
  },

  percentOf(cents, percentDecimal) {
    return Math.round((Number.isFinite(cents) ? cents : 0) * (Number.isFinite(percentDecimal) ? percentDecimal : 0));
  }
};

module.exports = FinancialMath;