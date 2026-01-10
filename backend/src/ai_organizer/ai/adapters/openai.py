"""
P4-2: OpenAI Provider Adapter

LLM and embedding provider using OpenAI API.
Supports GPT models and OpenAI embeddings.
"""

from __future__ import annotations

import time
import logging
from typing import List, Dict, Any, Optional

from ai_organizer.ai.providers import (
    LLMProvider,
    EmbeddingProvider,
    LLMRequest,
    LLMResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    LLMError,
    EmbeddingError,
    ProviderType,
)

logger = logging.getLogger(__name__)


class OpenAILLMProvider(LLMProvider):
    """
    LLM provider using OpenAI API.
    
    Supports GPT-3.5, GPT-4, and other OpenAI models.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize OpenAI LLM provider"""
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.default_model = config.get("model", "gpt-3.5-turbo")
        self.timeout = config.get("timeout", 30)
        self._client: Optional[Any] = None
    
    @property
    def provider_type(self) -> ProviderType:
        """Return provider type"""
        return ProviderType.OPENAI
    
    @property
    def supported_models(self) -> List[str]:
        """Return list of supported models"""
        return [
            "gpt-4",
            "gpt-4-turbo-preview",
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-16k",
        ]
    
    def _get_client(self):
        """Lazy-load OpenAI client"""
        if self._client is not None:
            return self._client
        
        try:
            from openai import AsyncOpenAI
            if not self.api_key:
                raise LLMError(
                    message="OpenAI API key not configured",
                    provider=self.provider_name,
                    code="missing_api_key",
                )
            self._client = AsyncOpenAI(api_key=self.api_key, timeout=self.timeout)
            return self._client
        except ImportError:
            raise LLMError(
                message="OpenAI library not installed. Install with: pip install openai",
                provider=self.provider_name,
                code="import_error",
            )
    
    def is_available(self) -> bool:
        """Check if provider is available"""
        try:
            from openai import AsyncOpenAI
            return bool(self.api_key)
        except ImportError:
            return False
    
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """
        Generate a completion using OpenAI API.
        
        Args:
            request: LLM request parameters
            
        Returns:
            LLM response with generated content
            
        Raises:
            LLMError: If the request fails
        """
        start_time = time.time()
        client = self._get_client()
        
        try:
            # Build messages for chat completion
            messages = []
            if request.system_prompt:
                messages.append({"role": "system", "content": request.system_prompt})
            messages.append({"role": "user", "content": request.prompt})
            
            # Build completion parameters
            completion_params = {
                "model": request.metadata.get("model") if request.metadata else None or self.default_model,
                "messages": messages,
                "temperature": request.temperature,
            }
            
            if request.max_tokens:
                completion_params["max_tokens"] = request.max_tokens
            if request.top_p:
                completion_params["top_p"] = request.top_p
            if request.frequency_penalty is not None:
                completion_params["frequency_penalty"] = request.frequency_penalty
            if request.presence_penalty is not None:
                completion_params["presence_penalty"] = request.presence_penalty
            if request.stop_sequences:
                completion_params["stop"] = request.stop_sequences
            
            # Make API call
            response = await client.chat.completions.create(**completion_params)
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Extract response content
            content = response.choices[0].message.content or ""
            finish_reason = response.choices[0].finish_reason
            
            # Extract token counts
            prompt_tokens = response.usage.prompt_tokens if response.usage else 0
            completion_tokens = response.usage.completion_tokens if response.usage else 0
            total_tokens = response.usage.total_tokens if response.usage else 0
            
            # Estimate cost (pricing as of 2024, may change)
            model = completion_params["model"]
            cost_estimate = self._estimate_cost(model, prompt_tokens, completion_tokens)
            
            return LLMResponse(
                content=content,
                provider=self.provider_name,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                latency_ms=latency_ms,
                cost_estimate=cost_estimate,
                finish_reason=finish_reason,
                metadata={
                    "model": model,
                    "finish_reason": finish_reason,
                    "response_id": response.id,
                },
            )
            
        except Exception as e:
            error_code = "api_error"
            error_details = {}
            
            # Handle OpenAI-specific errors
            if hasattr(e, "status_code"):
                error_code = f"http_{e.status_code}"
                error_details["status_code"] = e.status_code
            
            if hasattr(e, "message"):
                error_message = str(e.message)
            else:
                error_message = str(e)
            
            raise LLMError(
                message=f"OpenAI API error: {error_message}",
                provider=self.provider_name,
                code=error_code,
                details=error_details,
            ) from e
    
    def _estimate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        """
        Estimate cost based on model and token counts.
        
        Pricing (as of 2024, approximate):
        - GPT-4: $0.03/1K prompt tokens, $0.06/1K completion tokens
        - GPT-3.5-turbo: $0.0015/1K prompt tokens, $0.002/1K completion tokens
        """
        pricing = {
            "gpt-4": (0.03 / 1000, 0.06 / 1000),
            "gpt-4-turbo-preview": (0.01 / 1000, 0.03 / 1000),
            "gpt-3.5-turbo": (0.0015 / 1000, 0.002 / 1000),
            "gpt-3.5-turbo-16k": (0.003 / 1000, 0.004 / 1000),
        }
        
        prompt_price, completion_price = pricing.get(model, (0.002 / 1000, 0.002 / 1000))
        return (prompt_tokens * prompt_price) + (completion_tokens * completion_price)
    
    async def health_check(self) -> bool:
        """Check if provider is healthy"""
        try:
            if not self.is_available():
                return False
            
            # Test with a simple completion
            test_request = LLMRequest(
                prompt="Hello",
                max_tokens=5,
            )
            response = await self.complete(test_request)
            
            return bool(response.content)
            
        except Exception as e:
            logger.warning(f"Health check failed for OpenAI LLM provider: {e}")
            return False


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """
    Embedding provider using OpenAI API.
    
    Supports text-embedding-ada-002 and other OpenAI embedding models.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize OpenAI embedding provider"""
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.default_model = config.get("model", "text-embedding-ada-002")
        self.timeout = config.get("timeout", 30)
        self._client: Optional[Any] = None
    
    @property
    def provider_type(self) -> ProviderType:
        """Return provider type"""
        return ProviderType.OPENAI
    
    @property
    def supported_models(self) -> List[str]:
        """Return list of supported models"""
        return [
            "text-embedding-ada-002",  # Default, 1536 dimensions
            "text-embedding-3-small",  # Newer, 1536 dimensions
            "text-embedding-3-large",  # Newer, 3072 dimensions
        ]
    
    @property
    def default_dimension(self) -> int:
        """Return default embedding dimension"""
        if "large" in self.default_model:
            return 3072
        return 1536
    
    def _get_client(self):
        """Lazy-load OpenAI client"""
        if self._client is not None:
            return self._client
        
        try:
            from openai import AsyncOpenAI
            if not self.api_key:
                raise EmbeddingError(
                    message="OpenAI API key not configured",
                    provider=self.provider_name,
                    code="missing_api_key",
                )
            self._client = AsyncOpenAI(api_key=self.api_key, timeout=self.timeout)
            return self._client
        except ImportError:
            raise EmbeddingError(
                message="OpenAI library not installed. Install with: pip install openai",
                provider=self.provider_name,
                code="import_error",
            )
    
    def is_available(self) -> bool:
        """Check if provider is available"""
        try:
            from openai import AsyncOpenAI
            return bool(self.api_key)
        except ImportError:
            return False
    
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Generate embeddings using OpenAI API.
        
        Args:
            request: Embedding request with texts to embed
            
        Returns:
            Embedding response with vectors
            
        Raises:
            EmbeddingError: If embedding generation fails
        """
        start_time = time.time()
        client = self._get_client()
        
        try:
            model = request.model or self.default_model
            
            # Make API call (OpenAI handles batching automatically)
            response = await client.embeddings.create(
                model=model,
                input=request.texts,
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Extract embeddings
            embeddings = [item.embedding for item in response.data]
            dimension = len(embeddings[0]) if embeddings else self.default_dimension
            
            # Estimate cost (text-embedding-ada-002: $0.0001/1K tokens, approximate)
            total_tokens = sum(item.usage.total_tokens for item in response.data) if hasattr(response, 'data') and response.data else len(request.texts) * 100  # Rough estimate
            cost_estimate = (total_tokens / 1000) * 0.0001
            
            logger.debug(
                f"Generated {len(embeddings)} embeddings using OpenAI {model} "
                f"({dimension}D, {latency_ms:.1f}ms, ${cost_estimate:.6f})"
            )
            
            return EmbeddingResponse(
                embeddings=embeddings,
                provider=self.provider_name,
                model=model,
                dimension=dimension,
                latency_ms=latency_ms,
                cost_estimate=cost_estimate,
                metadata={
                    "model": model,
                    "text_count": len(request.texts),
                    "dimension": dimension,
                    "total_tokens": total_tokens,
                },
            )
            
        except Exception as e:
            error_code = "api_error"
            error_details = {}
            
            if hasattr(e, "status_code"):
                error_code = f"http_{e.status_code}"
                error_details["status_code"] = e.status_code
            
            if hasattr(e, "message"):
                error_message = str(e.message)
            else:
                error_message = str(e)
            
            raise EmbeddingError(
                message=f"OpenAI embedding API error: {error_message}",
                provider=self.provider_name,
                code=error_code,
                details=error_details,
            ) from e
    
    async def health_check(self) -> bool:
        """Check if provider is healthy"""
        try:
            if not self.is_available():
                return False
            
            # Test with a simple embedding
            test_request = EmbeddingRequest(texts=["test"])
            response = await self.embed(test_request)
            
            return len(response.embeddings) > 0 and len(response.embeddings[0]) > 0
            
        except Exception as e:
            logger.warning(f"Health check failed for OpenAI embedding provider: {e}")
            return False
