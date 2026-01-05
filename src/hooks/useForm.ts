// src/hooks/useForm.ts
import { useState, useCallback } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  custom?: (value: string) => string | null;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface FormErrors {
  [key: string]: string;
}

export interface FormState {
  values: { [key: string]: any };
  errors: FormErrors;
  touched: { [key: string]: boolean };
  isValid: boolean;
}

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationRules?: ValidationRules
) {
  const [state, setState] = useState<FormState>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true
  });

  const validateField = useCallback((
    name: string,
    value: any
  ): string | null => {
    const rules = validationRules?.[name];
    if (!rules) return null;

    if (rules.required && (!value || value.toString().trim() === '')) {
      return 'This field is required';
    }

    if (rules.email && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    if (rules.minLength && value && value.toString().length < rules.minLength) {
      return `Minimum length is ${rules.minLength} characters`;
    }

    if (rules.maxLength && value && value.toString().length > rules.maxLength) {
      return `Maximum length is ${rules.maxLength} characters`;
    }

    if (rules.pattern && value && !rules.pattern.test(value)) {
      return 'Invalid format';
    }

    if (rules.custom && value) {
      return rules.custom(value);
    }

    return null;
  }, [validationRules]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(state.values).forEach(name => {
      const error = validateField(name, state.values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setState(prev => ({
      ...prev,
      errors: newErrors,
      isValid
    }));

    return isValid;
  }, [state.values, validateField]);

  const setValue = useCallback((name: string, value: any) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      touched: { ...prev.touched, [name]: true },
      errors: {
        ...prev.errors,
        [name]: validateField(name, value) || ''
      }
    }));
  }, [validateField]);

  const setError = useCallback((name: string, error: string) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [name]: error },
      isValid: false
    }));
  }, []);

  const clearError = useCallback((name: string) => {
    setState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[name];
      return {
        ...prev,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0
      };
    });
  }, []);

  const reset = useCallback((newValues?: T) => {
    setState({
      values: newValues || initialValues,
      errors: {},
      touched: {},
      isValid: true
    });
  }, [initialValues]);

  const getFieldProps = useCallback((name: string) => ({
    name,
    value: state.values[name] || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(name, e.target.value);
    },
    onBlur: () => {
      setState(prev => ({
        ...prev,
        touched: { ...prev.touched, [name]: true }
      }));
    },
    error: state.touched[name] ? state.errors[name] : undefined
  }), [state.values, state.touched, state.errors, setValue]);

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid,
    setValue,
    setError,
    clearError,
    reset,
    validateForm,
    getFieldProps
  };
}
