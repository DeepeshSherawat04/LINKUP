// services/incomeSimulationService.js
const FinancialMath = require('../utils/financialMath');
const CostOfLivingService = require('./costOfLivingService');

class IncomeSimulationService {
  static async buildScenarios(offerDetails, personalFinances) {
    this._validateInputs(offerDetails, personalFinances);

    const baseAnnual = FinancialMath.toCents(offerDetails.base_salary);
    const equityPct = parseFloat(offerDetails.equity_percentage) || 0;
    const equityValuation = FinancialMath.toCents(offerDetails.equity_valuation || 0);
    const bonusTarget = FinancialMath.toCents(offerDetails.bonus_target_annual || 0);
    const location = offerDetails.location || 'Remote';
    const locationCountry = offerDetails.location_country || null;
    const companyType = offerDetails.company_type || 'startup';
    const companyName = offerDetails.company_name || 'Unknown';

    const rent = FinancialMath.toCents(personalFinances.monthly_rent || 0);
    const loans = FinancialMath.toCents(personalFinances.monthly_loans || 0);
    const expenses = FinancialMath.toCents(personalFinances.monthly_expenses || 0);
    const savings = FinancialMath.toCents(personalFinances.savings || 0);
    const hasRelocation = !!personalFinances.relocation_bonus;
    const relocationClawbackMonths = parseInt(personalFinances.relocation_clawback_months) || 0;
    const hasSeverance = !!personalFinances.severance_months;

    // === LIVE DATA FETCH ===
    const col = await CostOfLivingService.getCostOfLiving(location, locationCountry);
    
    const liveRent = col ? col.rent_1br_cents : rent;
    const liveTaxRate = col ? col.tax_rate : 0.30;
    const liveMarketAdjustment = col ? col.market_adjustment : 1.0;

    const effectiveRent = rent > 0 ? rent : liveRent;
    const monthlyFixed = effectiveRent + loans + expenses;

    const startup = this._buildStartupScenario(
      baseAnnual, equityPct, equityValuation, bonusTarget, location, companyName,
      monthlyFixed, savings, hasRelocation, relocationClawbackMonths, hasSeverance,
      liveTaxRate, liveMarketAdjustment, col
    );

    const bigTech = this._buildBigTechScenario(
      baseAnnual, equityPct, equityValuation, bonusTarget, location, companyName,
      monthlyFixed, savings, hasRelocation, relocationClawbackMonths, hasSeverance,
      liveTaxRate, liveMarketAdjustment, col
    );

    const remote = this._buildRemoteScenario(
      baseAnnual, equityPct, equityValuation, bonusTarget, location, companyName,
      monthlyFixed, savings, hasRelocation, relocationClawbackMonths, hasSeverance,
      liveTaxRate, liveMarketAdjustment, col
    );

    return [startup, bigTech, remote];
  }

  static _buildStartupScenario(baseAnnual, equityPct, equityValuation, bonusTarget, location, companyName,
    monthlyFixed, savings, hasRelocation, relocationClawbackMonths, hasSeverance,
    taxRate, marketAdjustment, colData) {
    
    const monthlyBase = FinancialMath.monthlyFromAnnual(baseAnnual);
    const monthlyBonus = FinancialMath.monthlyFromAnnual(bonusTarget * 0.5);
    const equityAnnual = FinancialMath.percentOf(equityValuation, equityPct / 100);
    const equityWorth = FinancialMath.percentOf(equityAnnual, 0.10);
    const monthlyEquity = FinancialMath.monthlyFromAnnual(equityWorth);

    const projection = [];
    let currentSavings = savings;
    let breakEvenMonth = null;
    const LAYOFF_MONTH = 18;
    const SEVERANCE_MONTHS = hasSeverance ? 2 : 0;

    for (let month = 1; month <= 24; month++) {
      let income = monthlyBase + monthlyBonus;
      if (month > 12) income += monthlyEquity;
      
      if (month === LAYOFF_MONTH) income += monthlyBase * SEVERANCE_MONTHS;
      if (month > LAYOFF_MONTH) income = 0;

      let clawback = 0;
      if (hasRelocation && month < relocationClawbackMonths && month === LAYOFF_MONTH) {
        clawback = FinancialMath.toCents(10000);
      }

      const tax = FinancialMath.percentOf(income, taxRate);
      const disposable = income - tax - monthlyFixed - clawback;
      currentSavings = FinancialMath.add(currentSavings, disposable);
      
      if (breakEvenMonth === null && currentSavings > savings) breakEvenMonth = month;

      projection.push({
        month,
        income_cents: income,
        tax_cents: tax,
        fixed_cents: monthlyFixed,
        disposable_cents: disposable,
        savings_cents: currentSavings,
        event: month === LAYOFF_MONTH ? 'LAYOFF_RISK' : null
      });
    }

    const trapRisk = this._calculateTrapRisk({
      companyType: 'startup', equityPct, equityIlliquid: true,
      hasRelocation, relocationClawbackMonths, hasSeverance,
      baseAnnual, marketRate: this._getMarketRate(location, colData),
      monthlyFixed, monthlyBase
    });

    return {
      name: `${companyName} (Startup Scenario)`,
      type: 'startup',
      projection,
      break_even_month: breakEvenMonth,
      trap_risk_score: trapRisk,
      risk_breakdown: this._getRiskBreakdown(trapRisk),
      data_source: colData ? { 
        source: colData.source, 
        city: colData.city, 
        country: colData.country,
        fetched_at: colData.fetched_at,
        data_quality: colData.data_quality || 'live',
        note: colData.note
      } : null,
      summary: {
        month_6_disposable_cents: projection[5]?.disposable_cents || 0,
        month_12_disposable_cents: projection[11]?.disposable_cents || 0,
        month_18_disposable_cents: projection[17]?.disposable_cents || 0,
        final_savings_cents: currentSavings
      }
    };
  }

  static _buildBigTechScenario(baseAnnual, equityPct, equityValuation, bonusTarget, location, companyName,
    monthlyFixed, savings, hasRelocation, relocationClawbackMonths, hasSeverance,
    taxRate, marketAdjustment, colData) {
    
    const monthlyBase = FinancialMath.monthlyFromAnnual(baseAnnual);
    const monthlyBonus = FinancialMath.monthlyFromAnnual(bonusTarget * 0.85);
    const equityAnnual = FinancialMath.percentOf(equityValuation, equityPct / 100);
    const monthlyEquity = FinancialMath.monthlyFromAnnual(equityAnnual);

    const projection = [];
    let currentSavings = savings;
    let breakEvenMonth = null;

    for (let month = 1; month <= 24; month++) {
      let income = monthlyBase + monthlyBonus;
      if (month > 12) income += monthlyEquity;
      if (month >= 18) income = Math.round(income * 1.08);

      const tax = FinancialMath.percentOf(income, taxRate);
      const disposable = income - tax - monthlyFixed;
      currentSavings = FinancialMath.add(currentSavings, disposable);
      
      if (breakEvenMonth === null && currentSavings > savings) breakEvenMonth = month;

      projection.push({
        month,
        income_cents: income,
        tax_cents: tax,
        fixed_cents: monthlyFixed,
        disposable_cents: disposable,
        savings_cents: currentSavings,
        event: month === 18 ? 'PROMOTION' : null
      });
    }

    const trapRisk = this._calculateTrapRisk({
      companyType: 'big_tech', equityPct, equityIlliquid: false,
      hasRelocation, relocationClawbackMonths, hasSeverance,
      baseAnnual, marketRate: this._getMarketRate(location, colData),
      monthlyFixed, monthlyBase
    });

    return {
      name: `${companyName} (Big Tech Scenario)`,
      type: 'big_tech',
      projection,
      break_even_month: breakEvenMonth,
      trap_risk_score: trapRisk,
      risk_breakdown: this._getRiskBreakdown(trapRisk),
      data_source: colData ? { 
        source: colData.source, 
        city: colData.city, 
        country: colData.country,
        fetched_at: colData.fetched_at,
        data_quality: colData.data_quality || 'live',
        note: colData.note
      } : null,
      summary: {
        month_6_disposable_cents: projection[5]?.disposable_cents || 0,
        month_12_disposable_cents: projection[11]?.disposable_cents || 0,
        month_18_disposable_cents: projection[17]?.disposable_cents || 0,
        final_savings_cents: currentSavings
      }
    };
  }

  static _buildRemoteScenario(baseAnnual, equityPct, equityValuation, bonusTarget, location, companyName,
    monthlyFixed, savings, hasRelocation, relocationClawbackMonths, hasSeverance,
    taxRate, marketAdjustment, colData) {
    
    const adjustedBase = FinancialMath.percentOf(baseAnnual, 0.85);
    const monthlyBase = FinancialMath.monthlyFromAnnual(adjustedBase);
    const monthlyBonus = FinancialMath.monthlyFromAnnual(bonusTarget * 0.60);
    const equityAnnual = FinancialMath.percentOf(equityValuation, equityPct / 100);
    const monthlyEquity = FinancialMath.monthlyFromAnnual(equityAnnual);

    const remoteRent = colData ? Math.round(colData.rent_1br_cents * 0.60) : FinancialMath.toCents(140000);
    const remoteMonthlyFixed = remoteRent + (monthlyFixed * 0.4);

    const projection = [];
    let currentSavings = savings;
    let breakEvenMonth = null;

    for (let month = 1; month <= 24; month++) {
      let income = monthlyBase + monthlyBonus;
      if (month > 12) income += monthlyEquity;
      if (month >= 21) income = Math.round(income * 1.04);

      const remoteTaxRate = taxRate * 0.90;
      const tax = FinancialMath.percentOf(income, remoteTaxRate);
      const disposable = income - tax - remoteMonthlyFixed;
      currentSavings = FinancialMath.add(currentSavings, disposable);
      
      if (breakEvenMonth === null && currentSavings > savings) breakEvenMonth = month;

      projection.push({
        month,
        income_cents: income,
        tax_cents: tax,
        fixed_cents: remoteMonthlyFixed,
        disposable_cents: disposable,
        savings_cents: currentSavings,
        event: month === 21 ? 'SLOW_PROMOTION' : null
      });
    }

    const trapRisk = this._calculateTrapRisk({
      companyType: 'remote', equityPct, equityIlliquid: false,
      hasRelocation, relocationClawbackMonths, hasSeverance,
      baseAnnual: adjustedBase, marketRate: this._getMarketRate('Remote', colData),
      monthlyFixed: remoteMonthlyFixed, monthlyBase
    });

    return {
      name: `${companyName} (Remote Scenario)`,
      type: 'remote',
      projection,
      break_even_month: breakEvenMonth,
      trap_risk_score: trapRisk,
      risk_breakdown: this._getRiskBreakdown(trapRisk),
      data_source: colData ? { 
        source: colData.source, 
        city: colData.city, 
        country: colData.country,
        fetched_at: colData.fetched_at,
        data_quality: colData.data_quality || 'live',
        note: colData.note
      } : null,
      summary: {
        month_6_disposable_cents: projection[5]?.disposable_cents || 0,
        month_12_disposable_cents: projection[11]?.disposable_cents || 0,
        month_18_disposable_cents: projection[17]?.disposable_cents || 0,
        final_savings_cents: currentSavings
      }
    };
  }

  static _calculateTrapRisk({ companyType, equityPct, equityIlliquid, hasRelocation, relocationClawbackMonths, hasSeverance, baseAnnual, marketRate, monthlyFixed, monthlyBase }) {
    let score = 0;
    if (equityIlliquid && equityPct > 1.0) score += 30;
    else if (equityIlliquid && equityPct > 0.5) score += 25;
    else if (equityIlliquid) score += 20;
    else if (companyType === 'startup') score += 15;
    else score += 5;

    if (hasRelocation && relocationClawbackMonths >= 24) score += 25;
    else if (hasRelocation && relocationClawbackMonths >= 12) score += 20;
    else if (hasRelocation) score += 15;

    if (!hasSeverance) score += 15;
    else score += 5;

    if (baseAnnual < marketRate * 0.85) score += 15;
    else if (baseAnnual < marketRate * 0.95) score += 10;
    else if (baseAnnual < marketRate) score += 5;

    const runwayMonths = monthlyBase > 0 ? Math.floor((monthlyBase * 3) / monthlyFixed) : 0;
    if (runwayMonths < 3) score += 15;
    else if (runwayMonths < 6) score += 10;
    else if (runwayMonths < 9) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  static _getRiskBreakdown(score) {
    if (score >= 70) return { level: 'HIGH', color: '#ef4444', label: 'High Trap Risk' };
    if (score >= 40) return { level: 'MEDIUM', color: '#f59e0b', label: 'Moderate Risk' };
    return { level: 'LOW', color: '#22c55e', label: 'Low Risk' };
  }

  static _getMarketRate(location, colData) {
    const baseRates = {
      'San Francisco': 18000000, 'New York': 17500000, 'Seattle': 16000000,
      'Austin': 13000000, 'Remote': 12000000, 'Default': 14000000
    };
    
    const key = Object.keys(baseRates).find(k => location?.toLowerCase().includes(k.toLowerCase()));
    let baseRate = key ? baseRates[key] : baseRates.Default;
    
    if (colData?.market_adjustment) {
      baseRate = Math.round(baseRate * colData.market_adjustment);
    }
    
    return baseRate;
  }

  static _validateInputs(offer, finances) {
    const requiredOffer = ['base_salary', 'location', 'company_type'];
    const requiredFinance = ['monthly_rent', 'monthly_loans', 'monthly_expenses'];
    
    for (const field of requiredOffer) {
      if (offer[field] === undefined || offer[field] === null || offer[field] === '') {
        throw new Error(`Missing required offer field: ${field}`);
      }
    }
    
    for (const field of requiredFinance) {
      if (finances[field] === undefined || finances[field] === null || finances[field] === '') {
        throw new Error(`Missing required finance field: ${field}`);
      }
    }

    const base = parseFloat(offer.base_salary);
    if (Number.isNaN(base) || base < 1000) throw new Error('Base salary must be at least $1,000');
  }
}

module.exports = IncomeSimulationService;