import { AddHoldingFormData, FormErrors, ValidationError } from '@/types/api';

export class ValidationService {
  static validateAddHoldingForm(formData: AddHoldingFormData): FormErrors {
    const errors: FormErrors = {};

    // Ticker validation
    if (!formData.ticker.trim()) {
      errors.ticker = 'Ticker symbol is required';
    } else if (!/^[A-Z0-9.-]{1,10}$/i.test(formData.ticker.trim())) {
      errors.ticker = 'Ticker must be 1-10 characters (letters, numbers, dots, hyphens only)';
    }

    // Shares validation
    if (!formData.shares.trim()) {
      errors.shares = 'Number of shares is required';
    } else {
      const shares = parseFloat(formData.shares);
      if (isNaN(shares) || shares <= 0) {
        errors.shares = 'Shares must be a positive number';
      } else if (shares > 1000000) {
        errors.shares = 'Shares cannot exceed 1,000,000';
      }
    }

    // Purchase price validation
    if (!formData.purchase_price.trim()) {
      errors.purchase_price = 'Purchase price is required';
    } else {
      const price = parseFloat(formData.purchase_price);
      if (isNaN(price) || price <= 0) {
        errors.purchase_price = 'Purchase price must be a positive number';
      } else if (price > 100000) {
        errors.purchase_price = 'Purchase price cannot exceed $100,000';
      }
    }

    // Purchase date validation
    if (!formData.purchase_date) {
      errors.purchase_date = 'Purchase date is required';
    } else {
      const purchaseDate = new Date(formData.purchase_date);
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 50); // Allow up to 50 years ago

      if (purchaseDate > today) {
        errors.purchase_date = 'Purchase date cannot be in the future';
      } else if (purchaseDate < oneYearAgo) {
        errors.purchase_date = 'Purchase date cannot be more than 50 years ago';
      }
    }

    // Commission validation (optional field)
    if (formData.commission.trim()) {
      const commission = parseFloat(formData.commission);
      if (isNaN(commission) || commission < 0) {
        errors.commission = 'Commission must be a non-negative number';
      } else if (commission > 1000) {
        errors.commission = 'Commission cannot exceed $1,000';
      }
    }

    // FX rate validation
    if (formData.currency !== 'USD') {
      if (!formData.fx_rate.trim()) {
        errors.fx_rate = 'Exchange rate is required for non-USD currencies';
      } else {
        const fxRate = parseFloat(formData.fx_rate);
        if (isNaN(fxRate) || fxRate <= 0) {
          errors.fx_rate = 'Exchange rate must be a positive number';
        } else if (fxRate > 1000) {
          errors.fx_rate = 'Exchange rate seems unrealistic (max: 1000)';
        }
      }
    }

    return errors;
  }

  static hasErrors(errors: FormErrors): boolean {
    return Object.keys(errors).length > 0;
  }

  static getErrorMessage(errors: FormErrors, field: string): string | undefined {
    return errors[field];
  }

  static sanitizeNumericInput(value: string): string {
    // Remove any non-numeric characters except decimal point
    return value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  }

  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  static formatNumber(value: number, decimals: number = 2): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
} 