"""
P4-2: AI Configuration Management

Centralized configuration for AI providers, privacy settings, and feature flags.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from enum import Enum
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
BACKEND_DIR = Path(__file__).resolve().parents[4]
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)


class AIFeature(str, Enum):
    """AI feature flags"""
    LLM_SUGGESTIONS = "llm_suggestions"  # Auto-suggest segment types/tags
    LLM_COUNTERARGUMENTS = "llm_counterarguments"  # Suggest counterarguments
    LLM_PREDICTIONS = "llm_predictions"  # Extract candidate predictions/tests
    LLM_OUTLINES = "llm_outlines"  # Generate draft outlines
    EMBEDDINGS = "embeddings"  # Semantic search via embeddings
    SEMANTIC_SEARCH = "semantic_search"  # Enable semantic search


@dataclass
class PrivacySettings:
    """Privacy and consent settings for AI features"""
    ai_enabled: bool = False  # Global AI feature flag
    send_to_external_apis: bool = False  # Allow sending content to external providers
    per_project_opt_in: bool = True  # Require explicit opt-in per project/document
    log_content: bool = False  # Log content sent to AI providers (for debugging)
    anonymize_content: bool = False  # Anonymize content before sending (future feature)


@dataclass
class ProviderConfig:
    """Configuration for a specific AI provider"""
    provider_type: str  # "openai", "gemini", "sentence_transformers", etc.
    enabled: bool = False
    api_key: Optional[str] = None
    api_url: Optional[str] = None  # For self-hosted or custom endpoints
    model: Optional[str] = None  # Default model name
    timeout: int = 30  # Request timeout in seconds
    max_retries: int = 3  # Maximum retry attempts
    retry_delay: float = 1.0  # Delay between retries (seconds)
    circuit_breaker_threshold: int = 5  # Failures before opening circuit
    circuit_breaker_timeout: int = 60  # Seconds before attempting recovery
    cost_limit_per_month: Optional[float] = None  # Monthly cost limit in USD
    rate_limit_per_minute: Optional[int] = None  # Rate limit per minute
    extra_config: Dict[str, Any] = field(default_factory=dict)  # Provider-specific config


@dataclass
class AIConfig:
    """
    Complete AI configuration for the system.
    
    This configuration is loaded from environment variables and can be
    overridden per-user or per-project for privacy/consent reasons.
    """
    # Global settings
    enabled: bool = False
    privacy: PrivacySettings = field(default_factory=PrivacySettings)
    features_enabled: Dict[AIFeature, bool] = field(default_factory=lambda: {
        AIFeature.LLM_SUGGESTIONS: False,
        AIFeature.LLM_COUNTERARGUMENTS: False,
        AIFeature.LLM_PREDICTIONS: False,
        AIFeature.LLM_OUTLINES: False,
        AIFeature.EMBEDDINGS: False,
        AIFeature.SEMANTIC_SEARCH: False,
    })
    
    # Provider configurations
    llm_provider: Optional[str] = None  # "openai", "gemini", etc. (None = disabled)
    embedding_provider: Optional[str] = None  # "openai", "sentence_transformers", etc. (None = disabled)
    
    providers: Dict[str, ProviderConfig] = field(default_factory=dict)
    
    # Default provider settings
    default_timeout: int = 30
    default_max_retries: int = 3
    default_retry_delay: float = 1.0
    
    @classmethod
    def from_env(cls) -> AIConfig:
        """
        Load AI configuration from environment variables.
        
        Environment variables:
        - AIORG_AI_ENABLED: Enable AI features globally (default: false)
        - AIORG_LLM_PROVIDER: LLM provider name (openai, gemini, etc.)
        - AIORG_EMBEDDING_PROVIDER: Embedding provider name (openai, sentence_transformers, etc.)
        - AIORG_AI_PRIVACY_SEND_TO_EXTERNAL: Allow sending content to external APIs (default: false)
        - AIORG_OPENAI_API_KEY: OpenAI API key
        - AIORG_OPENAI_MODEL: OpenAI default model (default: gpt-3.5-turbo)
        - AIORG_GEMINI_API_KEY: Gemini API key
        - AIORG_ANTHROPIC_API_KEY: Anthropic API key
        - etc.
        """
        enabled = os.getenv("AIORG_AI_ENABLED", "false").lower() == "true"
        
        privacy = PrivacySettings(
            ai_enabled=enabled,
            send_to_external_apis=os.getenv("AIORG_AI_PRIVACY_SEND_TO_EXTERNAL", "false").lower() == "true",
            per_project_opt_in=os.getenv("AIORG_AI_PRIVACY_PER_PROJECT_OPT_IN", "true").lower() == "true",
            log_content=os.getenv("AIORG_AI_LOG_CONTENT", "false").lower() == "true",
        )
        
        llm_provider = os.getenv("AIORG_LLM_PROVIDER", "").strip() or None
        embedding_provider = os.getenv("AIORG_EMBEDDING_PROVIDER", "").strip() or None
        
        # Initialize features (all disabled by default, must be explicitly enabled)
        features = {
            AIFeature.LLM_SUGGESTIONS: os.getenv("AIORG_AI_FEATURE_LLM_SUGGESTIONS", "false").lower() == "true",
            AIFeature.LLM_COUNTERARGUMENTS: os.getenv("AIORG_AI_FEATURE_LLM_COUNTERARGUMENTS", "false").lower() == "true",
            AIFeature.LLM_PREDICTIONS: os.getenv("AIORG_AI_FEATURE_LLM_PREDICTIONS", "false").lower() == "true",
            AIFeature.LLM_OUTLINES: os.getenv("AIORG_AI_FEATURE_LLM_OUTLINES", "false").lower() == "true",
            AIFeature.EMBEDDINGS: os.getenv("AIORG_AI_FEATURE_EMBEDDINGS", "false").lower() == "true",
            AIFeature.SEMANTIC_SEARCH: os.getenv("AIORG_AI_FEATURE_SEMANTIC_SEARCH", "false").lower() == "true",
        }
        
        # Load provider configurations
        providers: Dict[str, ProviderConfig] = {}
        
        # OpenAI configuration
        openai_key = os.getenv("AIORG_OPENAI_API_KEY", "").strip()
        if openai_key:
            providers["openai"] = ProviderConfig(
                provider_type="openai",
                enabled=enabled and llm_provider == "openai",
                api_key=openai_key,
                model=os.getenv("AIORG_OPENAI_MODEL", "gpt-3.5-turbo"),
                timeout=int(os.getenv("AIORG_OPENAI_TIMEOUT", "30")),
                max_retries=int(os.getenv("AIORG_OPENAI_MAX_RETRIES", "3")),
                cost_limit_per_month=float(os.getenv("AIORG_OPENAI_COST_LIMIT", "0")) or None,
            )
        
        # Gemini configuration
        gemini_key = os.getenv("AIORG_GEMINI_API_KEY", "").strip()
        if gemini_key:
            providers["gemini"] = ProviderConfig(
                provider_type="gemini",
                enabled=enabled and llm_provider == "gemini",
                api_key=gemini_key,
                model=os.getenv("AIORG_GEMINI_MODEL", "gemini-pro"),
                timeout=int(os.getenv("AIORG_GEMINI_TIMEOUT", "30")),
                max_retries=int(os.getenv("AIORG_GEMINI_MAX_RETRIES", "3")),
            )
        
        # Anthropic configuration
        anthropic_key = os.getenv("AIORG_ANTHROPIC_API_KEY", "").strip()
        if anthropic_key:
            providers["anthropic"] = ProviderConfig(
                provider_type="anthropic",
                enabled=enabled and llm_provider == "anthropic",
                api_key=anthropic_key,
                model=os.getenv("AIORG_ANTHROPIC_MODEL", "claude-3-haiku-20240307"),
                timeout=int(os.getenv("AIORG_ANTHROPIC_TIMEOUT", "30")),
                max_retries=int(os.getenv("AIORG_ANTHROPIC_MAX_RETRIES", "3")),
            )
        
        # Sentence Transformers (local, no API key needed)
        # Check if sentence-transformers is installed
        sentence_transformers_enabled = False
        try:
            import sentence_transformers
            sentence_transformers_enabled = True
        except ImportError:
            pass
        
        if sentence_transformers_enabled:
            providers["sentence_transformers"] = ProviderConfig(
                provider_type="sentence_transformers",
                enabled=enabled and (embedding_provider == "sentence_transformers" or not embedding_provider),
                model=os.getenv("AIORG_SENTENCE_TRANSFORMERS_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"),
                timeout=int(os.getenv("AIORG_SENTENCE_TRANSFORMERS_TIMEOUT", "60")),
                max_retries=int(os.getenv("AIORG_SENTENCE_TRANSFORMERS_MAX_RETRIES", "1")),
            )
        
        return cls(
            enabled=enabled,
            privacy=privacy,
            features_enabled=features,
            llm_provider=llm_provider,
            embedding_provider=embedding_provider,
            providers=providers,
            default_timeout=int(os.getenv("AIORG_AI_DEFAULT_TIMEOUT", "30")),
            default_max_retries=int(os.getenv("AIORG_AI_DEFAULT_MAX_RETRIES", "3")),
            default_retry_delay=float(os.getenv("AIORG_AI_DEFAULT_RETRY_DELAY", "1.0")),
        )
    
    def is_feature_enabled(self, feature: AIFeature) -> bool:
        """Check if a specific AI feature is enabled"""
        return (
            self.enabled
            and self.features_enabled.get(feature, False)
            and self.privacy.ai_enabled
        )
    
    def can_send_to_external(self) -> bool:
        """Check if content can be sent to external APIs"""
        return (
            self.enabled
            and self.privacy.ai_enabled
            and self.privacy.send_to_external_apis
        )
    
    def get_provider_config(self, provider_name: str) -> Optional[ProviderConfig]:
        """Get configuration for a specific provider"""
        return self.providers.get(provider_name)
    
    def is_provider_enabled(self, provider_name: str) -> bool:
        """Check if a provider is enabled and configured"""
        config = self.get_provider_config(provider_name)
        return config is not None and config.enabled


# Global AI configuration instance
_ai_config: Optional[AIConfig] = None


def get_ai_config() -> AIConfig:
    """Get the global AI configuration (singleton)"""
    global _ai_config
    if _ai_config is None:
        _ai_config = AIConfig.from_env()
    return _ai_config


def reload_ai_config():
    """Reload AI configuration from environment (useful for testing)"""
    global _ai_config
    _ai_config = AIConfig.from_env()
    return _ai_config
