"""
P4-2: Sentence Transformers Embedding Provider Adapter

Local embedding provider using sentence-transformers library.
No API key required, runs locally.
"""

from __future__ import annotations

import time
import logging
from typing import List, Dict, Any, Optional

from ai_organizer.ai.providers import (
    EmbeddingProvider,
    EmbeddingRequest,
    EmbeddingResponse,
    EmbeddingError,
    ProviderType,
)

logger = logging.getLogger(__name__)


class SentenceTransformersEmbeddingProvider(EmbeddingProvider):
    """
    Embedding provider using sentence-transformers library.
    
    This is a local provider that doesn't require API keys or external services.
    Perfect for privacy-sensitive applications.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Sentence Transformers provider"""
        super().__init__(config)
        self.model_name = config.get("model", "paraphrase-multilingual-MiniLM-L12-v2")
        self._model: Optional[Any] = None
        self._model_loaded = False
    
    @property
    def provider_type(self) -> ProviderType:
        """Return provider type"""
        return ProviderType.SENTENCE_TRANSFORMERS
    
    @property
    def supported_models(self) -> List[str]:
        """Return list of supported models"""
        return [
            "paraphrase-multilingual-MiniLM-L12-v2",  # Multilingual (Greek/English)
            "all-MiniLM-L6-v2",  # English-only, faster
            "paraphrase-MiniLM-L6-v2",  # English paraphrase
            "distiluse-base-multilingual-cased",  # Multilingual, larger
        ]
    
    @property
    def default_dimension(self) -> int:
        """Return default embedding dimension"""
        # Most sentence-transformers models use 384 dimensions
        # Some multilingual models use 512
        if "multilingual" in self.model_name.lower():
            return 512
        return 384
    
    def _load_model(self) -> None:
        """Lazy-load the embedding model"""
        if self._model_loaded:
            return
        
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading Sentence Transformers model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            self._model_loaded = True
            logger.info(f"Successfully loaded model: {self.model_name}")
        except ImportError:
            raise EmbeddingError(
                message="sentence-transformers library not installed. Install with: pip install sentence-transformers",
                provider=self.provider_name,
                code="import_error",
            )
        except Exception as e:
            raise EmbeddingError(
                message=f"Failed to load model {self.model_name}: {str(e)}",
                provider=self.provider_name,
                code="model_load_error",
                details={"model": self.model_name, "error": str(e)},
            )
    
    def is_available(self) -> bool:
        """Check if provider is available"""
        try:
            # Try to import sentence-transformers
            import sentence_transformers
            return True
        except ImportError:
            return False
    
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Generate embeddings for the given texts.
        
        Args:
            request: Embedding request with texts to embed
            
        Returns:
            Embedding response with vectors
            
        Raises:
            EmbeddingError: If embedding generation fails
        """
        start_time = time.time()
        
        try:
            # Load model if not already loaded
            self._load_model()
            
            if not self._model:
                raise EmbeddingError(
                    message="Model not loaded",
                    provider=self.provider_name,
                    code="model_not_loaded",
                )
            
            # Generate embeddings (sentence-transformers is synchronous, so we run in executor)
            # For now, we'll make it async-compatible by running in a thread pool
            import asyncio
            
            def _compute_embeddings():
                return self._model.encode(
                    request.texts,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                    show_progress_bar=False,
                )
            
            # Run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            embeddings_array = await loop.run_in_executor(None, _compute_embeddings)
            
            # Convert to list of lists (numpy array -> Python list)
            import numpy as np
            if isinstance(embeddings_array, np.ndarray):
                embeddings = embeddings_array.tolist()
            else:
                embeddings = [emb.tolist() if hasattr(emb, 'tolist') else emb for emb in embeddings_array]
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Get actual dimension from first embedding
            dimension = len(embeddings[0]) if embeddings else self.default_dimension
            
            # Local embeddings are free (no API cost)
            cost_estimate = 0.0
            
            logger.debug(
                f"Generated {len(embeddings)} embeddings using {self.model_name} "
                f"({dimension}D, {latency_ms:.1f}ms)"
            )
            
            return EmbeddingResponse(
                embeddings=embeddings,
                provider=self.provider_name,
                model=self.model_name,
                dimension=dimension,
                latency_ms=latency_ms,
                cost_estimate=cost_estimate,
                metadata={
                    "model": self.model_name,
                    "text_count": len(request.texts),
                    "dimension": dimension,
                },
            )
            
        except EmbeddingError:
            raise
        except Exception as e:
            raise EmbeddingError(
                message=f"Failed to generate embeddings: {str(e)}",
                provider=self.provider_name,
                code="embedding_error",
                details={"model": self.model_name, "text_count": len(request.texts), "error": str(e)},
            ) from e
    
    async def health_check(self) -> bool:
        """Check if provider is healthy"""
        try:
            if not self.is_available():
                return False
            
            # Try to load model (or verify it's already loaded)
            if not self._model_loaded:
                self._load_model()
            
            # Test with a simple embedding
            test_request = EmbeddingRequest(texts=["test"])
            response = await self.embed(test_request)
            
            return len(response.embeddings) > 0 and len(response.embeddings[0]) > 0
            
        except Exception as e:
            logger.warning(f"Health check failed for Sentence Transformers provider: {e}")
            return False
