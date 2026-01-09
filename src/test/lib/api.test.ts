// src/test/lib/api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  getAccessToken, 
  getRefreshToken, 
  setTokens, 
  clearTokens 
} from '../../lib/api'

describe('Token Helpers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('setTokens', () => {
    it('should store access and refresh tokens', () => {
      setTokens('access-token-123', 'refresh-token-456')
      
      expect(localStorage.getItem('aiorg_access_token')).toBe('access-token-123')
      expect(localStorage.getItem('aiorg_refresh_token')).toBe('refresh-token-456')
    })
  })

  describe('getAccessToken', () => {
    it('should return stored access token', () => {
      setTokens('access-token-123', 'refresh-token-456')
      
      expect(getAccessToken()).toBe('access-token-123')
    })

    it('should return null if no token exists', () => {
      expect(getAccessToken()).toBeNull()
    })

    it('should migrate from old tokenStore format', () => {
      const oldTokens = {
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token'
      }
      localStorage.setItem('aiorg_tokens_v1', JSON.stringify(oldTokens))
      
      const token = getAccessToken()
      expect(token).toBe('old-access-token')
      // Should migrate to new format
      expect(localStorage.getItem('aiorg_access_token')).toBe('old-access-token')
    })
  })

  describe('getRefreshToken', () => {
    it('should return stored refresh token', () => {
      setTokens('access-token-123', 'refresh-token-456')
      
      expect(getRefreshToken()).toBe('refresh-token-456')
    })

    it('should return null if no token exists', () => {
      expect(getRefreshToken()).toBeNull()
    })
  })

  describe('clearTokens', () => {
    it('should remove all tokens from localStorage', () => {
      setTokens('access-token-123', 'refresh-token-456')
      localStorage.setItem('aiorg_tokens_v1', '{}')
      
      clearTokens()
      
      expect(localStorage.getItem('aiorg_access_token')).toBeNull()
      expect(localStorage.getItem('aiorg_refresh_token')).toBeNull()
      expect(localStorage.getItem('aiorg_tokens_v1')).toBeNull()
    })
  })
})
