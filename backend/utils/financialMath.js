/**
 * Financial Math Utility
 * Production rule: All internal calculations use integer cents.
 * $1.00 = 100 cents. Eliminates IEEE-754 floating-point errors.
 */

const FinancialMath = {
  toCents(dollars) {
    const val = typeof dollars === 'string' ? parseFloat(dollars.replace(/[^0-9.-]/g, '')) : parseFloat(dollars);
    if (Number.isNaN(val)) throw new Error(`Invalid dollar amount: ${dollars}`);
    return Math.round(val * 100);
  },

  toDollars(cents) {
    return (cents / 100).toFixed(2);
  },

  add(a, b) {
    return a + b;
  },

  subtract(a, b) {
    return a - b;
  },

  multiply(a, b) {
    return Math.round(a * b);
  },

  divide(a, b) {
    if (b === 0) throw new Error('Division by zero in financial calculation');
    return Math.round(a / b);
  },

  monthlyFromAnnual(annualCents) {
    return Math.round(annualCents / 12);
  },

  annualFromMonthly(monthlyCents) {
    return monthlyCents * 12;
  },

  percentOf(cents, percentDecimal) {
    return Math.round(cents * percentDecimal);
  }
};

module.exports = FinancialMath;