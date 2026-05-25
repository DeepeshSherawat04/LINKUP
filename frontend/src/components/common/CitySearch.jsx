// components/common/CitySearch.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { incomeApi } from '../../api/incomeApi';
import './CitySearch.css';

/**
 * City Search Autocomplete
 * Searches ANY city worldwide using GeoDB API or cached data.
 */
export function CitySearch({ value, onChange, placeholder = "Search any city..." }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCities = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await incomeApi.searchCities(searchTerm);
      setSuggestions(response.data || []);
      setIsOpen(true);
    } catch (err) {
      console.error('[CitySearch] Failed to fetch cities:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCities(val);
    }, 300);
  };

  const handleSelect = (city) => {
    const displayValue = `${city.name}, ${city.country}`;
    setQuery(displayValue);
    setIsOpen(false);
    onChange({
      city: city.name,
      country: city.country,
      display: displayValue
    });
  };

  return (
    <div className="city-search-wrapper" ref={wrapperRef}>
      <div className="city-search-input-container">
        <input
          type="text"
          className="city-search-input"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          role="combobox"
        />
        {loading && <span className="city-search-spinner">⟳</span>}
        {query && (
          <button 
            className="city-search-clear" 
            onClick={() => { setQuery(''); setSuggestions([]); onChange(null); }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="city-search-dropdown" role="listbox">
          {suggestions.map((city, index) => (
            <li
              key={`${city.name}-${city.country}-${index}`}
              className="city-search-option"
              onClick={() => handleSelect(city)}
              role="option"
            >
              <span className="city-name">{city.name}</span>
              <span className="city-country">{city.country}</span>
              {city.population > 0 && (
                <span className="city-population">
                  {(city.population / 1000000).toFixed(1)}M
                </span>
              )}
              {city.from_cache && <span className="city-badge">cached</span>}
            </li>
          ))}
        </ul>
      )}

      {isOpen && query.length >= 2 && !loading && suggestions.length === 0 && (
        <div className="city-search-empty">
          No cities found. Try a different spelling or check your connection.
        </div>
      )}
    </div>
  );
}