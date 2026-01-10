"""
P4-2: Provider-Agnostic AI Abstractions

This module defines the core abstractions for LLM and embedding providers.
All providers must implement these interfaces to be compatible with the system.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ProviderType(str, Enum):
    """Supported provider types"""
    OPENAI = "openai"
    GEMINI = "gemini"
    ANTHROPIC = "anthropic"
    LLAMA = "llama"
    PERPLEXITY = "perplexity"
    DEEPSEEK = "deepseek"
    SENTENCE_TRANSFORMERS = "sentence_transformers"  # Local embeddings
    HUGGINGFACE = "huggingface"  # Local models


class LLMError(Exception):
    """Base exception for LLM provider errors"""
    def __init__(self, message: str, provider: str, code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.provider = provider
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


class EmbeddingError(Exception):
    """Base exception for embedding provider errors"""
    def __init__(self, message: str, provider: str, code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.provider = provider
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


@dataclass
class LLMRequest:
    """Request for LLM completion"""
    prompt: str
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    stop_sequences: Optional[List[str]] = None
    stream: bool = False
    metadata: Optional[Dict[str, Any]] = None  # For provenance tracking


@dataclass
class LLMResponse:
    """Response from LLM provider"""
    content: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    cost_estimate: float = 0.0  # Estimated cost in USD
    metadata: Optional[Dict[str, Any]] = None  # Provider-specific metadata
    finish_reason: Optional[str] = None  # "stop", "length", "content_filter", etc.


@dataclass
class EmbeddingRequest:
    """Request for embedding generation"""
    texts: List[str]  # Can be single or batch
    model: Optional[str] = None  # Provider-specific model name
    metadata: Optional[Dict[str, Any]] = None  # For provenance tracking


@dataclass
class EmbeddingResponse:
    """Response from embedding provider"""
    embeddings: List[List[float]]  # List of embedding vectors
    provider: str
    model: str
    dimension: int  # Embedding dimension
    latency_ms: float = 0.0
    cost_estimate: float = 0.0  # Estimated cost in USD
    metadata: Optional[Dict[str, Any]] = None  # Provider-specific metadata


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    All LLM providers must implement this interface to be compatible
    with the AI Organizer system.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the provider with configuration.
        
        Args:
            config: Provider-specific configuration dict
                   (e.g., API keys, model names, timeouts)
        """
        self.config = config
        self.provider_name = self.__class__.__name__.replace("Provider", "").lower()
    
    @property
    @abstractmethod
    def provider_type(self) -> ProviderType:
        """Return the provider type"""
        pass
    
    @property
    @abstractmethod
    def supported_models(self) -> List[str]:
        """Return list of supported model names"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if the provider is available and configured.
        
        Returns:
            True if provider can be used, False otherwise
        """
        pass
    
    @abstractmethod
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """
        Generate a completion from the LLM.
        
        Args:
            request: LLM request parameters
            
        Returns:
            LLM response with generated content
            
        Raises:
            LLMError: If the request fails
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the provider is healthy and reachable.
        
        Returns:
            True if healthy, False otherwise
        """
        pass
    
    def estimate_cost(self, request: LLMRequest, response: Optional[LLMResponse] = None) -> float:
        """
        Estimate the cost of a request (in USD).
        
        This is a default implementation that can be overridden by providers.
        
        Args:
            request: The LLM request
            response: Optional response to get actual token counts
            
        Returns:
            Estimated cost in USD (0.0 if cost tracking not supported)
        """
        # Default: no cost estimation
        return 0.0


class EmbeddingProvider(ABC):
    """
    Abstract base class for embedding providers.
    
    All embedding providers must implement this interface to be compatible
    with the AI Organizer system.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the provider with configuration.
        
        Args:
            config: Provider-specific configuration dict
                   (e.g., API keys, model names, batch sizes)
        """
        self.config = config
        self.provider_name = self.__class__.__name__.replace("Provider", "").lower()
    
    @property
    @abstractmethod
    def provider_type(self) -> ProviderType:
        """Return the provider type"""
        pass
    
    @property
    @abstractmethod
    def supported_models(self) -> List[str]:
        """Return list of supported model names"""
        pass
    
    @property
    @abstractmethod
    def default_dimension(self) -> int:
        """Return the default embedding dimension for this provider"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if the provider is available and configured.
        
        Returns:
            True if provider can be used, False otherwise
        """
        pass
    
    @abstractmethod
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Generate embeddings for the given texts.
        
        Args:
            request: Embedding request parameters
            
        Returns:
            Embedding response with vectors
            
        Raises:
            EmbeddingError: If the request fails
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the provider is healthy and reachable.
        
        Returns:
            True if healthy, False otherwise
        """
        pass
    
    def estimate_cost(self, request: EmbeddingRequest, response: Optional[EmbeddingResponse] = None) -> float:
        """
        Estimate the cost of a request (in USD).
        
        This is a default implementation that can be overridden by providers.
        
        Args:
            request: The embedding request
            response: Optional response to get actual token counts
            
        Returns:
            Estimated cost in USD (0.0 if cost tracking not supported)
        """
        # Default: no cost estimation
        return 0.0


class CircuitBreakerState(str, Enum):
    """Circuit breaker states"""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests immediately
    HALF_OPEN = "half_open"  # Testing if provider recovered


class CircuitBreaker:
    """
    Simple circuit breaker for provider resilience.
    
    Prevents cascading failures by opening the circuit after
    consecutive failures, then attempting recovery.
    """
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of consecutive failures before opening
            recovery_timeout: Seconds to wait before attempting recovery
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitBreakerState.CLOSED
    
    def record_success(self):
        """Record a successful request"""
        self.failure_count = 0
        self.state = CircuitBreakerState.CLOSED
    
    def record_failure(self):
        """Record a failed request"""
        import time
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            logger.warning(
                f"Circuit breaker opened after {self.failure_count} failures. "
                f"Will attempt recovery after {self.recovery_timeout}s"
            )
    
    def should_attempt(self) -> bool:
        """Check if request should be attempted"""
        import time
        
        if self.state == CircuitBreakerState.CLOSED:
            return True
        
        if self.state == CircuitBreakerState.OPEN:
            if self.last_failure_time and (time.time() - self.last_failure_time) >= self.recovery_timeout:
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info("Circuit breaker entering half-open state (testing recovery)")
                return True
            return False
        
        # HALF_OPEN: allow one request to test recovery
        return True
