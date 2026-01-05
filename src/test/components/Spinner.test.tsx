// src/test/components/Spinner.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Spinner, LoadingSpinner } from '../../components/ui/Spinner'

describe('Spinner', () => {
  it('renders spinner with default size', () => {
    render(<Spinner />)
    const spinner = screen.getByRole('img') || screen.getByTestId('spinner')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('w-6', 'h-6')
  })

  it('renders spinner with custom size', () => {
    render(<Spinner size="lg" />)
    const spinner = screen.getByRole('img') || screen.getByTestId('spinner')
    expect(spinner).toHaveClass('w-8', 'h-8')
  })

  it('renders loading spinner with text', () => {
    render(<LoadingSpinner text="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Spinner className="custom-class" />)
    const spinner = screen.getByRole('img') || screen.getByTestId('spinner')
    expect(spinner).toHaveClass('custom-class')
  })
})
