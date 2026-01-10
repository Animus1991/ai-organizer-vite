"""
P4-2: AI Manager

Central manager for AI providers. Handles provider registration, selection,
error handling, retries, circuit breakers, and cost/latency logging.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Dict, Any, List
from functools import wraps

from ai_organizer.ai.providers import (
    LLMProvider,
    EmbeddingProvider,
    LLMRequest,
    LLMResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    LLMError,
    EmbeddingError,
    CircuitBreaker,
)
from ai_organizer.ai.config import AIConfig, get_ai_config, AIFeature

logger = logging.getLogger(__name__)


def retry_with_backoff(max_retries: int = 3, initial_delay: float = 1.0, max_delay: float = 10.0):
    """Decorator for retrying operations with exponential backoff"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            delay = initial_delay
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except (LLMError, EmbeddingError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {e.message}. "
                            f"Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                        delay = min(delay * 2, max_delay)
                    else:
                        logger.error(f"All {max_retries} attempts failed for {func.__name__}: {e.message}")
            
            raise last_error
        
        return wrapper
    return decorator


# Import asyncio for sleep
import asyncio


class AIManager:
    """
    Central manager for AI providers.
    
    Handles:
    - Provider registration and selection
    - Error handling and retries
    - Circuit breakers
    - Cost/latency logging
    - Privacy checks
    """
    
    def __init__(self, config: Optional[AIConfig] = None):
        """
        Initialize AI Manager.
        
        Args:
            config: AI configuration (default: load from environment)
        """
        self.config = config or get_ai_config()
        self.llm_providers: Dict[str, LLMProvider] = {}
        self.embedding_providers: Dict[str, EmbeddingProvider] = {}
        self.llm_circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.embedding_circuit_breakers: Dict[str, CircuitBreaker] = {}
        
        # Cost/latency tracking
        self.total_cost: float = 0.0
        self.total_llm_requests: int = 0
        self.total_embedding_requests: int = 0
        self.total_latency_ms: float = 0.0
        
        # Initialize providers from configuration
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize providers based on configuration"""
        if not self.config.enabled:
            logger.info("AI features are disabled. No providers will be initialized.")
            return
        
        # Lazy import adapters to avoid errors if dependencies not installed
        try:
            # Try to load OpenAI provider
            if self.config.is_provider_enabled("openai"):
                try:
                    from ai_organizer.ai.adapters.openai import OpenAILLMProvider, OpenAIEmbeddingProvider
                    openai_config = self.config.get_provider_config("openai")
                    if openai_config:
                        # Initialize LLM provider
                        if self.config.llm_provider == "openai":
                            self.llm_providers["openai"] = OpenAILLMProvider(openai_config.__dict__)
                            self.llm_circuit_breakers["openai"] = CircuitBreaker(
                                failure_threshold=openai_config.circuit_breaker_threshold,
                                recovery_timeout=openai_config.circuit_breaker_timeout,
                            )
                        # Initialize embedding provider
                        if self.config.embedding_provider == "openai":
                            self.embedding_providers["openai"] = OpenAIEmbeddingProvider(openai_config.__dict__)
                            self.embedding_circuit_breakers["openai"] = CircuitBreaker(
                                failure_threshold=openai_config.circuit_breaker_threshold,
                                recovery_timeout=openai_config.circuit_breaker_timeout,
                            )
                except ImportError as e:
                    logger.warning(f"OpenAI adapter not available: {e}. Install with: pip install openai")
        except Exception as e:
            logger.warning(f"Error loading OpenAI provider: {e}")
        
        # Load Sentence Transformers provider (local, no API key needed)
        if self.config.is_provider_enabled("sentence_transformers"):
            try:
                from ai_organizer.ai.adapters.sentence_transformers import SentenceTransformersEmbeddingProvider
                st_config = self.config.get_provider_config("sentence_transformers")
                if st_config:
                    self.embedding_providers["sentence_transformers"] = SentenceTransformersEmbeddingProvider(st_config.__dict__)
                    self.embedding_circuit_breakers["sentence_transformers"] = CircuitBreaker(
                        failure_threshold=st_config.circuit_breaker_threshold,
                        recovery_timeout=st_config.circuit_breaker_timeout,
                    )
            except ImportError as e:
                logger.warning(f"Sentence Transformers adapter not available: {e}")
            except Exception as e:
                logger.warning(f"Error loading Sentence Transformers provider: {e}")
        
        logger.info(
            f"AI Manager initialized: {len(self.llm_providers)} LLM providers, "
            f"{len(self.embedding_providers)} embedding providers"
        )
    
    def get_llm_provider(self, provider_name: Optional[str] = None) -> Optional[LLMProvider]:
        """
        Get the active LLM provider.
        
        Args:
            provider_name: Optional provider name (default: use config default)
            
        Returns:
            LLM provider instance or None if not available
        """
        if not self.config.enabled or not self.config.can_send_to_external():
            return None
        
        provider_name = provider_name or self.config.llm_provider
        if not provider_name:
            return None
        
        provider = self.llm_providers.get(provider_name)
        if not provider or not provider.is_available():
            return None
        
        # Check circuit breaker
        circuit_breaker = self.llm_circuit_breakers.get(provider_name)
        if circuit_breaker and not circuit_breaker.should_attempt():
            logger.warning(f"Circuit breaker is OPEN for LLM provider: {provider_name}")
            return None
        
        return provider
    
    def get_embedding_provider(self, provider_name: Optional[str] = None) -> Optional[EmbeddingProvider]:
        """
        Get the active embedding provider.
        
        Args:
            provider_name: Optional provider name (default: use config default)
            
        Returns:
            Embedding provider instance or None if not available
        """
        if not self.config.enabled:
            # Embeddings can work without external APIs (sentence-transformers is local)
            pass
        
        provider_name = provider_name or self.config.embedding_provider or "sentence_transformers"
        provider = self.embedding_providers.get(provider_name)
        if not provider or not provider.is_available():
            return None
        
        # Check circuit breaker
        circuit_breaker = self.embedding_circuit_breakers.get(provider_name)
        if circuit_breaker and not circuit_breaker.should_attempt():
            logger.warning(f"Circuit breaker is OPEN for embedding provider: {provider_name}")
            return None
        
        return provider
    
    async def complete(self, request: LLMRequest, provider_name: Optional[str] = None) -> Optional[LLMResponse]:
        """
        Generate a completion using the active LLM provider.
        
        Args:
            request: LLM request parameters
            provider_name: Optional provider name (default: use config default)
            
        Returns:
            LLM response or None if provider not available
            
        Raises:
            LLMError: If the request fails after retries
        """
        provider = self.get_llm_provider(provider_name)
        if not provider:
            return None
        
        provider_name = provider_name or self.config.llm_provider or "unknown"
        circuit_breaker = self.llm_circuit_breakers.get(provider_name)
        
        start_time = time.time()
        
        try:
            # Check privacy settings
            if not self.config.can_send_to_external():
                raise LLMError(
                    message="External AI APIs are disabled. Enable AIORG_AI_PRIVACY_SEND_TO_EXTERNAL to use LLM features.",
                    provider=provider_name,
                    code="privacy_disabled",
                )
            
            # Execute request with retries
            provider_config = self.config.get_provider_config(provider_name)
            max_retries = provider_config.max_retries if provider_config else self.config.default_max_retries
            retry_delay = provider_config.retry_delay if provider_config else self.config.default_retry_delay
            
            @retry_with_backoff(max_retries=max_retries, initial_delay=retry_delay)
            async def _complete():
                return await provider.complete(request)
            
            response = await _complete()
            
            # Record success
            if circuit_breaker:
                circuit_breaker.record_success()
            
            # Log cost and latency
            latency_ms = (time.time() - start_time) * 1000
            self.total_llm_requests += 1
            self.total_latency_ms += latency_ms
            self.total_cost += response.cost_estimate
            
            logger.info(
                f"LLM request completed: {provider_name} "
                f"({response.total_tokens} tokens, {latency_ms:.1f}ms, ${response.cost_estimate:.6f})"
            )
            
            return response
            
        except (LLMError, Exception) as e:
            # Record failure
            if circuit_breaker:
                circuit_breaker.record_failure()
            
            logger.error(f"LLM request failed: {provider_name} - {str(e)}")
            
            if isinstance(e, LLMError):
                raise
            
            raise LLMError(
                message=f"Unexpected error: {str(e)}",
                provider=provider_name,
                code="unexpected_error",
                details={"error_type": type(e).__name__},
            ) from e
    
    async def embed(self, request: EmbeddingRequest, provider_name: Optional[str] = None) -> Optional[EmbeddingResponse]:
        """
        Generate embeddings using the active embedding provider.
        
        Args:
            request: Embedding request parameters
            provider_name: Optional provider name (default: use config default)
            
        Returns:
            Embedding response or None if provider not available
            
        Raises:
            EmbeddingError: If the request fails after retries
        """
        provider = self.get_embedding_provider(provider_name)
        if not provider:
            return None
        
        provider_name = provider_name or self.config.embedding_provider or "unknown"
        circuit_breaker = self.embedding_circuit_breakers.get(provider_name)
        
        start_time = time.time()
        
        try:
            # Execute request with retries
            provider_config = self.config.get_provider_config(provider_name)
            max_retries = provider_config.max_retries if provider_config else self.config.default_max_retries
            retry_delay = provider_config.retry_delay if provider_config else self.config.default_retry_delay
            
            @retry_with_backoff(max_retries=max_retries, initial_delay=retry_delay)
            async def _embed():
                return await provider.embed(request)
            
            response = await _embed()
            
            # Record success
            if circuit_breaker:
                circuit_breaker.record_success()
            
            # Log cost and latency
            latency_ms = (time.time() - start_time) * 1000
            self.total_embedding_requests += 1
            self.total_latency_ms += latency_ms
            self.total_cost += response.cost_estimate
            
            logger.info(
                f"Embedding request completed: {provider_name} "
                f"({len(request.texts)} texts, {latency_ms:.1f}ms, ${response.cost_estimate:.6f})"
            )
            
            return response
            
        except (EmbeddingError, Exception) as e:
            # Record failure
            if circuit_breaker:
                circuit_breaker.record_failure()
            
            logger.error(f"Embedding request failed: {provider_name} - {str(e)}")
            
            if isinstance(e, EmbeddingError):
                raise
            
            raise EmbeddingError(
                message=f"Unexpected error: {str(e)}",
                provider=provider_name,
                code="unexpected_error",
                details={"error_type": type(e).__name__},
            ) from e
    
    def get_stats(self) -> Dict[str, Any]:
        """Get usage statistics"""
        return {
            "total_cost_usd": self.total_cost,
            "total_llm_requests": self.total_llm_requests,
            "total_embedding_requests": self.total_embedding_requests,
            "total_latency_ms": self.total_latency_ms,
            "average_latency_ms": (
                self.total_latency_ms / (self.total_llm_requests + self.total_embedding_requests)
                if (self.total_llm_requests + self.total_embedding_requests) > 0
                else 0.0
            ),
            "enabled_providers": {
                "llm": list(self.llm_providers.keys()),
                "embedding": list(self.embedding_providers.keys()),
            },
        }


# Global AI Manager instance (singleton)
_ai_manager: Optional[AIManager] = None


def get_ai_manager() -> AIManager:
    """Get the global AI Manager instance"""
    global _ai_manager
    if _ai_manager is None:
        _ai_manager = AIManager()
    return _ai_manager
