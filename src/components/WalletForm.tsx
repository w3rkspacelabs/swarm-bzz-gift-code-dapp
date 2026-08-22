import React, { useState } from 'react';
import { CONFIG } from '../config';

export interface WalletFormData {
  xdaiAmount: number;
  xbzzAmount: number;
  walletCount: number;
}

interface WalletFormProps {
  onSubmit: (data: WalletFormData) => void;
  isLoading?: boolean;
  className?: string;
}

export function WalletForm({ onSubmit, isLoading = false, className = '' }: WalletFormProps) {
  const [formData, setFormData] = useState<WalletFormData>({
    xdaiAmount: CONFIG.MIN_XDAI_AMOUNT,
    xbzzAmount: CONFIG.MIN_XBZZ_AMOUNT,
    walletCount: 1
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate xDAI amount
    if (formData.xdaiAmount < CONFIG.MIN_XDAI_AMOUNT) {
      newErrors.xdaiAmount = `xDAI amount must be at least ${CONFIG.MIN_XDAI_AMOUNT}`;
    }

    // Validate xBZZ amount
    if (formData.xbzzAmount < CONFIG.MIN_XBZZ_AMOUNT) {
      newErrors.xbzzAmount = `xBZZ amount must be at least ${CONFIG.MIN_XBZZ_AMOUNT}`;
    }

    // Validate wallet count
    if (formData.walletCount < 1) {
      newErrors.walletCount = 'Must generate at least 1 wallet';
    } else if (formData.walletCount > CONFIG.MAX_WALLETS_PER_GENERATION) {
      newErrors.walletCount = `Cannot generate more than ${CONFIG.MAX_WALLETS_PER_GENERATION} wallets at once`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof WalletFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`wallet-form ${className}`}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="xdaiAmount" className="form-label">
            xDAI per wallet
          </label>
          <input
            id="xdaiAmount"
            type="number"
            step="0.01"
            min={CONFIG.MIN_XDAI_AMOUNT}
            value={formData.xdaiAmount}
            onChange={(e) => handleInputChange('xdaiAmount', parseFloat(e.target.value) || 0)}
            className={`form-input ${errors.xdaiAmount ? 'error' : ''}`}
            placeholder="0.01"
            disabled={isLoading}
          />
          {errors.xdaiAmount && <span className="error-message">{errors.xdaiAmount}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="xbzzAmount" className="form-label">
            xBZZ per wallet
          </label>
          <input
            id="xbzzAmount"
            type="number"
            step="0.01"
            min={CONFIG.MIN_XBZZ_AMOUNT}
            value={formData.xbzzAmount}
            onChange={(e) => handleInputChange('xbzzAmount', parseFloat(e.target.value) || 0)}
            className={`form-input ${errors.xbzzAmount ? 'error' : ''}`}
            placeholder="0"
            disabled={isLoading}
          />
          {errors.xbzzAmount && <span className="error-message">{errors.xbzzAmount}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="walletCount" className="form-label">
          Number of wallets to generate
        </label>
        <input
          id="walletCount"
          type="number"
          min="1"
          max={CONFIG.MAX_WALLETS_PER_GENERATION}
          value={formData.walletCount}
          onChange={(e) => handleInputChange('walletCount', parseInt(e.target.value) || 1)}
          className={`form-input ${errors.walletCount ? 'error' : ''}`}
          placeholder="1"
          disabled={isLoading}
        />
        {errors.walletCount && <span className="error-message">{errors.walletCount}</span>}
        <small className="form-hint">
          Maximum {CONFIG.MAX_WALLETS_PER_GENERATION} wallets per generation
        </small>
      </div>

      <button
        type="submit"
        className="submit-button"
        disabled={isLoading}
      >
        {isLoading ? 'Generating Codes...' : 'Generate Codes'}
      </button>
    </form>
  );
} 