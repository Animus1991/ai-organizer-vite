"""
P4-2: Provider-Agnostic AI Interface

This module provides abstractions for LLM and embedding providers, allowing
the system to work with multiple AI providers (OpenAI, Gemini, Llama, etc.)
without vendor lock-in.

Key principles:
- Provider-agnostic: No hardcoded vendor assumptions
- Optional: System works without AI features enabled
- Swappable: Providers can be changed via configuration
- Privacy-first: Opt-in, per-project settings
- Observable: Cost/latency logging, error handling
"""

from ai_organizer.ai.providers import (
    LLMProvider,
    EmbeddingProvider,
    LLMRequest,
    LLMResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    LLMError,
    EmbeddingError,
)
from ai_organizer.ai.manager import AIManager
from ai_organizer.ai.config import AIConfig, get_ai_config

__all__ = [
    "LLMProvider",
    "EmbeddingProvider",
    "LLMRequest",
    "LLMResponse",
    "EmbeddingRequest",
    "EmbeddingResponse",
    "LLMError",
    "EmbeddingError",
    "AIManager",
    "AIConfig",
    "get_ai_config",
]
