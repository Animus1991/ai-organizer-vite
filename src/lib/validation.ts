// src/lib/validation.ts
// Form validation utilities

export interface ValidationRule {
  required?: boolean;
  email?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null; // Returns error message or null
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateEmail(email: string): string | null {
  if (!email || email.trim() === "") {
    return "Email is required";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return "Please enter a valid email address";
  }
  return null;
}

export function validatePassword(password: string, isSignUp: boolean = false): string | null {
  if (!password || password.trim() === "") {
    return "Password is required";
  }
  if (isSignUp) {
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    if (password.length > 128) {
      return "Password must be less than 128 characters";
    }
  }
  return null;
}

export function validateFile(file: File | null, options?: {
  maxSizeMB?: number;
  allowedTypes?: string[];
}): string | null {
  if (!file) {
    return "Please select a file";
  }

  if (options?.maxSizeMB) {
    const maxSizeBytes = options.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${options.maxSizeMB}MB`;
    }
  }

  if (options?.allowedTypes && options.allowedTypes.length > 0) {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;
    
    const isAllowed = options.allowedTypes.some(type => {
      // Check by extension
      if (type.startsWith('.')) {
        return fileExtension === type.substring(1);
      }
      // Check by MIME type
      return mimeType === type || mimeType.startsWith(type + '/');
    });

    if (!isAllowed) {
      return `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`;
    }
  }

  return null;
}

export function validateForm<T extends Record<string, any>>(
  values: T,
  rules: Record<keyof T, ValidationRule>
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [field, value] of Object.entries(values)) {
    const rule = rules[field as keyof T];
    if (!rule) continue;

    let error: string | null = null;

    // Required check
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      error = `${field} is required`;
    }
    // Email check
    else if (rule.email && typeof value === 'string') {
      error = validateEmail(value);
    }
    // Min length check
    else if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      error = `${field} must be at least ${rule.minLength} characters`;
    }
    // Max length check
    else if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      error = `${field} must be less than ${rule.maxLength} characters`;
    }
    // Pattern check
    else if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      error = `${field} format is invalid`;
    }
    // Custom validation
    else if (rule.custom && typeof value === 'string') {
      error = rule.custom(value);
    }

    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Real-time validation hook
export function useFieldValidation(
  value: string,
  rules: ValidationRule
): { error: string | null; isValid: boolean } {
  const result = validateForm({ value }, { value: rules });
  return {
    error: result.errors.value || null,
    isValid: result.isValid
  };
}

