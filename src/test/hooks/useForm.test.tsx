// src/test/hooks/useForm.test.tsx
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useForm } from '../../hooks/useForm'

describe('useForm', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => 
      useForm({ email: '', password: '' })
    )
    
    expect(result.current.values.email).toBe('')
    expect(result.current.values.password).toBe('')
    expect(result.current.isValid).toBe(true)
  })

  it('validates required fields', () => {
    const { result } = renderHook(() => 
      useForm(
        { email: '', password: '' },
        { email: { required: true } }
      )
    )
    
    act(() => {
      result.current.validateForm()
    })
    
    expect(result.current.isValid).toBe(false)
    expect(result.current.errors.email).toBe('This field is required')
  })

  it('validates email format', () => {
    const { result } = renderHook(() => 
      useForm(
        { email: 'invalid-email', password: '' },
        { email: { required: true, email: true } }
      )
    )
    
    act(() => {
      result.current.validateForm()
    })
    
    expect(result.current.isValid).toBe(false)
    expect(result.current.errors.email).toBe('Please enter a valid email address')
  })

  it('validates min length', () => {
    const { result } = renderHook(() => 
      useForm(
        { email: '', password: '123' },
        { password: { required: true, minLength: 6 } }
      )
    )
    
    act(() => {
      result.current.validateForm()
    })
    
    expect(result.current.isValid).toBe(false)
    expect(result.current.errors.password).toBe('Minimum length is 6 characters')
  })

  it('updates values and validates on change', () => {
    const { result } = renderHook(() => 
      useForm(
        { email: '', password: '' },
        { email: { required: true, email: true } }
      )
    )
    
    act(() => {
      result.current.setValue('email', 'test@example.com')
    })
    
    expect(result.current.values.email).toBe('test@example.com')
    expect(result.current.errors.email).toBe('')
  })

  it('resets form to initial values', () => {
    const { result } = renderHook(() => 
      useForm({ email: '', password: '' })
    )
    
    act(() => {
      result.current.setValue('email', 'test@example.com')
      result.current.reset()
    })
    
    expect(result.current.values.email).toBe('')
    expect(result.current.errors).toEqual({})
  })
})
