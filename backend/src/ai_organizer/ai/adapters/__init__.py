"""
P4-2: AI Provider Adapters

This module contains concrete implementations of LLM and embedding providers.
Each provider adapter implements the LLMProvider or EmbeddingProvider interface.

Available adapters:
- OpenAI (LLM + Embeddings)
- Gemini (LLM, embeddings coming)
- Anthropic Claude (LLM)
- Sentence Transformers (Embeddings, local)
- Future: Llama, Perplexity, DeepSeek, HuggingFace, etc.
"""

# Import adapters (lazy import to avoid errors if dependencies not installed)
# Adapters will be imported dynamically in manager.py

__all__ = []
