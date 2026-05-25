/// Income Simulator Panel
import React, { useState, useCallback } from 'react';
import { incomeApi } from '../../api/incomeApi';
import { CitySearch } from '../common/CitySearch'; // NEW
import { FinancialProjectionChart } from './FinancialProjectionChart';
import { TrapRiskMeter } from './TrapRiskMeter';
import './IncomeSimulatorPanel.css';

/**
 * Income Protection Simulator Panel
 * Production-grade financial stress tester.
 */
export function IncomeSimulatorPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  const [inputs, setInputs] = useState({
    simulation_name: '',
    company_name: '',
    base_salary: '',
    equity_percentage: '0.5',
    equity_valuation: '',
    bonus_target_annual: '',
    location: null, // Now stores { city, country, display }
    company_type: 'startup',
    monthly_rent: '',
    monthly_loans: '',
    monthly_expenses: '',
    savings: '15000',
    relocation_bonus: false,
    relocation_clawback_months: '24',
    severance_months: false
  });

  const handleChange = useCallback((field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCitySelect = useCallback((cityData) => {
    setInputs(prev => ({ ...prev, location: cityData }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (!inputs.location) {
        throw new Error('Please select a city from the search dropdown');
      }

      const offerDetails = {
        company_name: inputs.company_name,
        base_salary: parseFloat(inputs.base_salary),
        equity_percentage: parseFloat(inputs.equity_percentage),
        equity_valuation: parseFloat(inputs.equity_valuation) || 0,
        bonus_target_annual: parseFloat(inputs.bonus_target_annual) || 0,
        location: inputs.location.city,
        location_country: inputs.location.country,
        company_type: inputs.company_type
      };

      const personalFinances = {
        monthly_rent: parseFloat(inputs.monthly_rent) || 0,
        monthly_loans: parseFloat(inputs.monthly_loans) || 0,
        monthly_expenses: parseFloat(inputs.monthly_expenses) || 0,
        savings: parseFloat(inputs.savings) || 0,
        relocation_bonus: inputs.relocation_bonus,
        relocation_clawback_months: parseInt(inputs.relocation_clawback_months) || 0,
        severance_months: inputs.severance_months
      };

      const response = await incomeApi.simulate(offerDetails, personalFinances, inputs.simulation_name);
      setResult(response.data);
    } catch (err) {
      setError(err.message || 'Simulation failed. Check inputs and try again.');
      console.error('[IncomeSimulatorPanel]', err);
    } finally {
      setLoading(false);
    }
  }, [inputs]);

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(cents / 100);
  };

  return (
    <div className="income-simulator-panel">
      <div className="panel-header">
        <h2>💰 Income Protection Simulator</h2>
        <p className="panel-subtitle">Model 24-month cash flows across Startup, Big Tech, and Remote scenarios</p>
      </div>

      <form onSubmit={handleSubmit} className="simulator-form">
        <div className="form-section">
          <h3>Offer Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name</label>
              <input 
                type="text" 
                value={inputs.company_name} 
                onChange={e => handleChange('company_name', e.target.value)}
                placeholder="e.g., Stripe"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Base Salary ($)</label>
              <input 
                type="number" 
                value={inputs.base_salary} 
                onChange={e => handleChange('base_salary', e.target.value)}
                placeholder="120000"
                min="1000"
                required
              />
            </div>

            <div className="form-group">
              <label>Equity %</label>
              <input 
                type="number" 
                step="0.01"
                value={inputs.equity_percentage} 
                onChange={e => handleChange('equity_percentage', e.target.value)}
                placeholder="0.5"
              />
            </div>

            <div className="form-group">
              <label>Company Valuation ($)</label>
              <input 
                type="number" 
                value={inputs.equity_valuation} 
                onChange={e => handleChange('equity_valuation', e.target.value)}
                placeholder="100000000"
              />
            </div>

            <div className="form-group">
              <label>Bonus Target ($)</label>
              <input 
                type="number" 
                value={inputs.bonus_target_annual} 
                onChange={e => handleChange('bonus_target_annual', e.target.value)}
                placeholder="15000"
              />
            </div>

            <div className="form-group form-group-full">
              <label>Location (Search any city worldwide)</label>
              <CitySearch 
                value={inputs.location?.display}
                onChange={handleCitySelect}
                placeholder="Type to search cities..."
              />
              {inputs.location && (
                <span className="location-hint">
                  CoL data will be fetched live for {inputs.location.display}
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Company Type</label>
              <select value={inputs.company_type} onChange={e => handleChange('company_type', e.target.value)}>
                <option value="startup">Startup</option>
                <option value="big_tech">Big Tech</option>
                <option value="remote">Remote-First</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Personal Finances</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Monthly Rent ($)</label>
              <input 
                type="number" 
                value={inputs.monthly_rent} 
                onChange={e => handleChange('monthly_rent', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Monthly Loans ($)</label>
              <input 
                type="number" 
                value={inputs.monthly_loans} 
                onChange={e => handleChange('monthly_loans', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Other Monthly Expenses ($)</label>
              <input 
                type="number" 
                value={inputs.monthly_expenses} 
                onChange={e => handleChange('monthly_expenses', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Current Savings ($)</label>
              <input 
                type="number" 
                value={inputs.savings} 
                onChange={e => handleChange('savings', e.target.value)}
              />
            </div>
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={inputs.relocation_bonus} 
                onChange={e => handleChange('relocation_bonus', e.target.checked)}
              />
              Relocation Bonus with Clawback
            </label>
            {inputs.relocation_bonus && (
              <input 
                type="number" 
                value={inputs.relocation_clawback_months} 
                onChange={e => handleChange('relocation_clawback_months', e.target.value)}
                placeholder="Clawback months (e.g., 24)"
                className="clawback-input"
              />
            )}
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={inputs.severance_months} 
                onChange={e => handleChange('severance_months', e.target.checked)}
              />
              Documented Severance (2+ months)
            </label>
          </div>
        </div>

        <button type="submit" className="simulate-btn" disabled={loading}>
          {loading ? 'Running 24-Month Projection...' : 'Run Financial Stress Test'}
        </button>
        
        {error && <div className="error-banner" role="alert">{error}</div>}
      </form>

      {result && (
        <div className="results-container">
          <h3>Scenario Comparison</h3>
          <div className="scenario-cards">
            {result.scenarios.map(scenario => (
              <div key={scenario.type} className={`scenario-card ${scenario.trap_risk_score >= 70 ? 'danger' : scenario.trap_risk_score >= 40 ? 'warning' : 'safe'}`}>
                <div className="scenario-header">
                  <h4>{scenario.name}</h4>
                  <TrapRiskMeter score={scenario.trap_risk_score} breakdown={scenario.risk_breakdown} />
                </div>
                
                <div className="scenario-metrics">
                  <div className="metric">
                    <span className="metric-label">Month 6 Disposable</span>
                    <span className="metric-value">{formatCurrency(scenario.summary.month_6_disposable_cents)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Month 12 Disposable</span>
                    <span className="metric-value">{formatCurrency(scenario.summary.month_12_disposable_cents)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Month 18 Disposable</span>
                    <span className="metric-value">{formatCurrency(scenario.summary.month_18_disposable_cents)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Final Savings</span>
                    <span className="metric-value">{formatCurrency(scenario.summary.final_savings_cents)}</span>
                  </div>
                </div>

                {scenario.break_even_month && (
                  <div className="break-even">Break-even month: {scenario.break_even_month}</div>
                )}
              </div>
            ))}
          </div>

          <div className="chart-section">
            <h4>24-Month Cash Flow Projection</h4>
            <FinancialProjectionChart scenarios={result.scenarios} />
          </div>

          <div className="negotiation-leverage">
            <h4>💡 Negotiation Leverage</h4>
            <ul>
              {result.scenarios.find(s => s.type === 'startup')?.trap_risk_score > 50 && (
                <li>Startup offer has high trap risk. Ask for: <strong>1.5x base OR 2x equity with 1-year acceleration</strong></li>
              )}
              {result.scenarios.find(s => s.type === 'big_tech')?.trap_risk_score < 30 && (
                <li>Big Tech offer is stable. Negotiate for <strong>signing bonus and faster vesting</strong> rather than base.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}