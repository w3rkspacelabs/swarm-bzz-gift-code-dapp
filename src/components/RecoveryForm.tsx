import React, { useState } from 'react';

export interface RecoveryFormData {
  privateKeys: string;
}

interface RecoveryFormProps {
  onSubmit: (data: RecoveryFormData) => void;
  isLoading?: boolean;
  className?: string;
}

export function RecoveryForm({ onSubmit, isLoading = false, className = '' }: RecoveryFormProps) {
  const [formData, setFormData] = useState<RecoveryFormData>({
    privateKeys: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate private keys
    if (!formData.privateKeys.trim()) {
      newErrors.privateKeys = 'Private keys are required';
    } else {
      const keys = formData.privateKeys
        .split(/[,\s\n]+/)
        .map(key => key.trim())
        .filter(key => key.length > 0);

      if (keys.length === 0) {
        newErrors.privateKeys = 'No valid private keys found';
      }
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

  const handleInputChange = (field: keyof RecoveryFormData, value: string) => {
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

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    // Auto-format pasted text to separate by newlines
    const formattedText = pastedText
      .split(/[,\s\n]+/)
      .filter(key => key.trim().length > 0)
      .join('\n');
    
    setFormData(prev => ({ ...prev, privateKeys: formattedText }));
  };

  return (
    <form onSubmit={handleSubmit} className={`recovery-form ${className}`}>
      <div className="form-group">
        <label htmlFor="privateKeys" className="form-label">
          Gift Codes (Private Keys)
        </label>
        <textarea
          id="privateKeys"
          value={formData.privateKeys}
          onChange={(e) => handleInputChange('privateKeys', e.target.value)}
          onPaste={handlePaste}
          className={`form-textarea ${errors.privateKeys ? 'error' : ''}`}
          placeholder="Enter private keys separated by commas or newlines\nExample:\n0x1234567890abcdef...\n0xabcdef1234567890..."
          rows={8}
          disabled={isLoading}
        />
        {errors.privateKeys && <span className="error-message">{errors.privateKeys}</span>}
        <small className="form-hint">
          You can paste multiple private keys separated by commas, spaces, or newlines.
          The system will automatically format them for processing.
        </small>
      </div>

      <button
        type="submit"
        className="submit-button"
        disabled={isLoading}
      >
        {isLoading ? 'Recovering Funds...' : 'Recover Funds'}
      </button>
    </form>
  );
} 