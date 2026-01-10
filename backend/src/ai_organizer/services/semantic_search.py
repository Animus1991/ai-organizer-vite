# backend/src/ai_organizer/services/semantic_search.py
"""
Advanced Semantic Search Service

Provides semantic search capabilities with:
- Keyword variations (lemmatization, plural/singular, tenses)
- Custom synonyms support
- Multi-language support (Greek, English)
- Semantic similarity using embeddings (sentence-transformers)

Uses sentence-transformers for free, multilingual semantic search.
"""

from __future__ import annotations

import re
import hashlib
import json
from typing import List, Dict, Set, Optional, Tuple
from functools import lru_cache
import logging
from pathlib import Path

# Try to import sentence-transformers (optional dependency)
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    SENTENCE_TRANSFORMERS_AVAILABLE = True
    SentenceTransformerType = SentenceTransformer  # For type hints
except (ImportError, Exception) as e:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SentenceTransformerType = None  # For type hints
    np = None  # For type hints
    import logging
    logging.warning(f"sentence-transformers not available: {e}. Install with: pip install sentence-transformers")

# Try to import spaCy for Greek/English NLP (optional dependency)
# NOTE: spaCy has compatibility issues with Python 3.14+ and Pydantic v2
# We use lazy import and catch all exceptions for graceful fallback
SPACY_AVAILABLE = False
_spacy_module = None

def _try_import_spacy():
    """Lazy import spaCy with full exception handling for compatibility issues"""
    global SPACY_AVAILABLE, _spacy_module
    if SPACY_AVAILABLE:
        return _spacy_module
    
    try:
        import spacy
        _spacy_module = spacy
        SPACY_AVAILABLE = True
        return spacy
    except (ImportError, Exception) as e:
        SPACY_AVAILABLE = False
        _spacy_module = None
        import logging
        logging.warning(f"spaCy not available (compatibility issue with Python 3.14+): {e}. "
                       f"Semantic search will work without keyword variations. "
                       f"Install with: pip install spacy && python -m spacy download el_core_news_sm en_core_web_sm")
        return None

logger = logging.getLogger(__name__)

# Global models (lazy-loaded)
_embedding_model: Optional[SentenceTransformerType] = None
_nlp_el: Optional[object] = None  # Greek spaCy model
_nlp_en: Optional[object] = None  # English spaCy model

# Embedding cache (in-memory + disk)
_embedding_cache: Dict[str, any] = {}  # Use 'any' to avoid type errors if numpy not available
_EMBEDDING_CACHE_DIR = Path(__file__).parent.parent.parent / ".cache" / "embeddings"
try:
    _EMBEDDING_CACHE_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass  # Cache directory creation is optional
_CACHE_SIZE_LIMIT = 1000  # Maximum number of embeddings to cache in memory


def get_embedding_model() -> Optional[any]:
    """Lazy-load the embedding model (paraphrase-multilingual for Greek/English support)"""
    global _embedding_model
    
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        return None
    
    if _embedding_model is None:
        try:
            # Import here to avoid issues if sentence-transformers not available
            from sentence_transformers import SentenceTransformer
            # Use paraphrase-multilingual model that supports Greek and English
            # This is a free, open-source model that works well for semantic search
            _embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            logger.info("Loaded paraphrase-multilingual-MiniLM-L12-v2 model for semantic search")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            return None
    
    return _embedding_model


def get_nlp_model(lang: str = "el") -> Optional[object]:
    """Lazy-load spaCy NLP model for Greek or English"""
    global _nlp_el, _nlp_en, SPACY_AVAILABLE
    
    # Lazy import spaCy to avoid compatibility issues on module load
    spacy = _try_import_spacy()
    if spacy is None:
        return None
    
    if lang == "el":
        if _nlp_el is None:
            try:
                _nlp_el = spacy.load("el_core_news_sm")
                logger.info("Loaded Greek spaCy model (el_core_news_sm)")
            except (OSError, Exception) as e:
                logger.warning(f"Greek spaCy model not available: {e}. Install with: python -m spacy download el_core_news_sm")
                return None
        return _nlp_el
    elif lang == "en":
        if _nlp_en is None:
            try:
                _nlp_en = spacy.load("en_core_web_sm")
                logger.info("Loaded English spaCy model (en_core_web_sm)")
            except (OSError, Exception) as e:
                logger.warning(f"English spaCy model not available: {e}. Install with: python -m spacy download en_core_web_sm")
                return None
        return _nlp_en
    
    return None


class SynonymManager:
    """Manages custom synonyms and built-in synonym dictionaries"""
    
    def __init__(self):
        # Custom synonyms dictionary (word -> set of synonyms)
        self.custom_synonyms: Dict[str, Set[str]] = {}
        
        # Built-in synonyms (limited set for common words)
        # These can be expanded or loaded from external dictionaries
        self.builtin_synonyms: Dict[str, Set[str]] = {
            # English examples
            "search": {"find", "look", "seek", "query"},
            "document": {"file", "paper", "text", "article"},
            "segment": {"chunk", "part", "section", "portion"},
            "folder": {"directory", "category", "group"},
            # Greek examples (transliterated for now, can be improved)
            "αναζήτηση": {"εύρεση", "αναζητώ", "ψάχνω"},
            "έγγραφο": {"αρχείο", "χαρτί", "κείμενο"},
            "τμήμα": {"κομμάτι", "μέρος", "ενότητα"},
            "φάκελος": {"κατάλογος", "κατηγορία", "ομάδα"},
        }
    
    def add_synonym(self, word: str, synonym: str):
        """Add a custom synonym pair (bidirectional)"""
        word_lower = word.lower().strip()
        synonym_lower = synonym.lower().strip()
        
        if word_lower == synonym_lower:
            return
        
        # Add bidirectional synonyms
        if word_lower not in self.custom_synonyms:
            self.custom_synonyms[word_lower] = set()
        if synonym_lower not in self.custom_synonyms:
            self.custom_synonyms[synonym_lower] = set()
        
        self.custom_synonyms[word_lower].add(synonym_lower)
        self.custom_synonyms[synonym_lower].add(word_lower)
    
    def get_synonyms(self, word: str) -> Set[str]:
        """Get all synonyms for a word (custom + built-in)"""
        word_lower = word.lower().strip()
        synonyms = set()
        
        # Add custom synonyms
        if word_lower in self.custom_synonyms:
            synonyms.update(self.custom_synonyms[word_lower])
        
        # Add built-in synonyms
        if word_lower in self.builtin_synonyms:
            synonyms.update(self.builtin_synonyms[word_lower])
        
        # Also check reverse (if synonym is in custom dict, include original)
        for key, values in self.custom_synonyms.items():
            if word_lower in values:
                synonyms.add(key)
        
        for key, values in self.builtin_synonyms.items():
            if word_lower in values:
                synonyms.add(key)
        
        return synonyms
    
    def remove_synonym(self, word: str, synonym: str):
        """Remove a custom synonym pair"""
        word_lower = word.lower().strip()
        synonym_lower = synonym.lower().strip()
        
        if word_lower in self.custom_synonyms:
            self.custom_synonyms[word_lower].discard(synonym_lower)
            if not self.custom_synonyms[word_lower]:
                del self.custom_synonyms[word_lower]
        
        if synonym_lower in self.custom_synonyms:
            self.custom_synonyms[synonym_lower].discard(word_lower)
            if not self.custom_synonyms[synonym_lower]:
                del self.custom_synonyms[synonym_lower]


# Global synonym manager instance
_synonym_manager = SynonymManager()


def expand_query_with_variations(query: str, lang: str = "auto") -> List[str]:
    """
    Expand a search query with keyword variations:
    - Lemmatization (lemma forms) - requires spaCy
    - Plural/singular variations - requires spaCy
    - Tense variations (for verbs) - requires spaCy
    - Synonyms (custom + built-in) - always available
    
    Returns a list of query variations.
    """
    variations = [query]  # Original query is always included
    
    # Detect language if auto
    if lang == "auto":
        # Simple heuristic: if query contains Greek characters, use Greek
        if re.search(r'[Α-Ωα-ω]', query):
            lang = "el"
        else:
            lang = "en"
    
    # Get NLP model for language (may return None if spaCy not available)
    nlp = get_nlp_model(lang)
    
    if nlp:
        try:
            doc = nlp(query)
            for token in doc:
                # Add lemma (base form)
                if token.lemma_ and token.lemma_.lower() != token.text.lower():
                    variations.append(query.replace(token.text, token.lemma_))
                
                # Add plural/singular variations (if available in spaCy)
                # Note: spaCy has limited support for this, so we use a simple approach
                # For Greek, we can add common plural/singular patterns
                if lang == "el":
                    # Greek plural/singular variations (simplified)
                    # -ος -> -οι (masculine), -η -> -ες (feminine), -ο -> -α (neuter)
                    if token.text.endswith("ος"):
                        plural = token.text[:-2] + "οι"
                        variations.append(query.replace(token.text, plural))
                    elif token.text.endswith("η"):
                        plural = token.text[:-1] + "ες"
                        variations.append(query.replace(token.text, plural))
                    elif token.text.endswith("ο"):
                        plural = token.text[:-1] + "α"
                        variations.append(query.replace(token.text, plural))
                
                # Add synonyms (always available, even without spaCy)
                synonyms = _synonym_manager.get_synonyms(token.text)
                for synonym in synonyms:
                    variations.append(query.replace(token.text, synonym))
        except Exception as e:
            logger.warning(f"Error expanding query with NLP: {e}. Falling back to synonyms only.")
            # Fallback to synonyms only
            words = query.split()
            for word in words:
                synonyms = _synonym_manager.get_synonyms(word)
                for synonym in synonyms:
                    variations.append(query.replace(word, synonym))
    else:
        # Fallback: just add synonyms if NLP not available (e.g., spaCy compatibility issue)
        words = query.split()
        for word in words:
            synonyms = _synonym_manager.get_synonyms(word)
            for synonym in synonyms:
                variations.append(query.replace(word, synonym))
    
    # Remove duplicates while preserving order
    seen = set()
    unique_variations = []
    for var in variations:
        var_lower = var.lower()
        if var_lower not in seen:
            seen.add(var_lower)
            unique_variations.append(var)
    
    return unique_variations


def _get_text_hash(text: str) -> str:
    """Generate a hash for a text (for caching)"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def _load_embedding_from_cache(text_hash: str) -> Optional[any]:
    """Load embedding from disk cache"""
    if not SENTENCE_TRANSFORMERS_AVAILABLE or np is None:
        return None
    
    cache_file = _EMBEDDING_CACHE_DIR / f"{text_hash}.npy"
    if cache_file.exists():
        try:
            embedding = np.load(cache_file)
            return embedding
        except Exception as e:
            logger.warning(f"Error loading embedding from cache: {e}")
            return None
    return None


def _save_embedding_to_cache(text_hash: str, embedding: any):
    """Save embedding to disk cache"""
    if not SENTENCE_TRANSFORMERS_AVAILABLE or np is None:
        return
    
    try:
        cache_file = _EMBEDDING_CACHE_DIR / f"{text_hash}.npy"
        np.save(cache_file, embedding)
    except Exception as e:
        logger.warning(f"Error saving embedding to cache: {e}")


def compute_embeddings(texts: List[str], use_cache: bool = True, batch_size: int = 32) -> Optional[any]:
    """
    Compute embeddings for a list of texts using the embedding model.
    Uses caching and batch processing for performance.
    
    Args:
        texts: List of texts to compute embeddings for
        use_cache: Whether to use caching (memory + disk)
        batch_size: Batch size for processing (to avoid memory issues)
    
    Returns:
        A numpy array of shape (n_texts, embedding_dim) or None if model not available.
    """
    model = get_embedding_model()
    if model is None:
        return None
    
    if not texts:
        return None
    
    # Import numpy here (should be available if sentence-transformers is available)
    if not SENTENCE_TRANSFORMERS_AVAILABLE or np is None:
        logger.error("numpy not available for embeddings")
        return None
    
    # Check cache for each text
    cached_embeddings: Dict[int, any] = {}  # Use 'any' to avoid type errors if numpy not available
    texts_to_compute: List[Tuple[int, str]] = []  # (index, text)
    
    if use_cache:
        for i, text in enumerate(texts):
            text_hash = _get_text_hash(text)
            
            # Check in-memory cache first
            if text_hash in _embedding_cache:
                cached_embeddings[i] = _embedding_cache[text_hash]
            else:
                # Check disk cache
                cached = _load_embedding_from_cache(text_hash)
                if cached is not None:
                    cached_embeddings[i] = cached
                    # Also add to in-memory cache
                    if len(_embedding_cache) < _CACHE_SIZE_LIMIT:
                        _embedding_cache[text_hash] = cached
                else:
                    texts_to_compute.append((i, text))
    else:
        texts_to_compute = [(i, text) for i, text in enumerate(texts)]
    
    # If all texts are cached, return cached embeddings
    if not texts_to_compute:
        embeddings_list = [cached_embeddings[i] for i in range(len(texts))]
        return np.array(embeddings_list)
    
    # Compute embeddings for uncached texts in batches
    try:
        texts_to_encode = [text for _, text in texts_to_compute]
        
        # Process in batches to avoid memory issues
        all_computed_embeddings = []
        for batch_start in range(0, len(texts_to_encode), batch_size):
            batch_texts = texts_to_encode[batch_start:batch_start + batch_size]
            batch_embeddings = model.encode(
                batch_texts,
                convert_to_numpy=True,
                show_progress_bar=False,
                batch_size=min(batch_size, len(batch_texts))
            )
            all_computed_embeddings.append(batch_embeddings)
        
        computed_embeddings = np.vstack(all_computed_embeddings)
        
        # Cache computed embeddings
        if use_cache:
            for (i, text), embedding in zip(texts_to_compute, computed_embeddings):
                text_hash = _get_text_hash(text)
                
                # Add to in-memory cache (if not full)
                if len(_embedding_cache) < _CACHE_SIZE_LIMIT:
                    _embedding_cache[text_hash] = embedding
                
                # Save to disk cache
                _save_embedding_to_cache(text_hash, embedding)
        
        # Combine cached and computed embeddings
        result_embeddings = []
        computed_idx = 0
        for i in range(len(texts)):
            if i in cached_embeddings:
                result_embeddings.append(cached_embeddings[i])
            else:
                result_embeddings.append(computed_embeddings[computed_idx])
                computed_idx += 1
        
        return np.array(result_embeddings)
    
    except Exception as e:
        logger.error(f"Error computing embeddings: {e}")
        return None


def semantic_search(
    query: str,
    texts: List[str],
    top_k: int = 10,
    similarity_threshold: float = 0.3,
    expand_variations: bool = True,
    lang: str = "auto"
) -> List[Tuple[int, float, str]]:
    """
    Perform semantic search on a list of texts.
    
    Args:
        query: Search query string
        texts: List of texts to search in
        top_k: Number of top results to return
        similarity_threshold: Minimum similarity score (0-1)
        expand_variations: Whether to expand query with variations
        lang: Language for NLP processing ("auto", "el", "en")
    
    Returns:
        List of tuples (index, similarity_score, text) sorted by similarity (descending)
    """
    if not texts:
        return []
    
    # Expand query with variations if enabled
    query_variations = [query]
    if expand_variations:
        query_variations = expand_query_with_variations(query, lang=lang)
        # Limit variations to avoid too many embeddings
        query_variations = query_variations[:5]  # Use top 5 variations
    
    # Compute embeddings for query variations
    query_embeddings = compute_embeddings(query_variations)
    if query_embeddings is None:
        # Fallback to simple text matching if embeddings not available
        return _fallback_text_search(query, texts, top_k)
    
    # Use the first (original) query embedding for search
    query_embedding = query_embeddings[0]
    
    # Compute embeddings for all texts
    text_embeddings = compute_embeddings(texts)
    if text_embeddings is None:
        return _fallback_text_search(query, texts, top_k)
    
    # Check if numpy is available for similarity computation
    if not SENTENCE_TRANSFORMERS_AVAILABLE or np is None:
        return _fallback_text_search(query, texts, top_k)
    
    # Compute cosine similarity
    # Normalize embeddings
    try:
        query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-8)
        text_norms = text_embeddings / (np.linalg.norm(text_embeddings, axis=1, keepdims=True) + 1e-8)
        
        # Compute cosine similarity (dot product of normalized vectors)
        similarities = np.dot(text_norms, query_norm)
    except Exception as e:
        logger.warning(f"Error computing cosine similarity: {e}. Falling back to text search.")
        return _fallback_text_search(query, texts, top_k)
    
    # Filter by threshold and get top_k
    results = []
    for i, similarity in enumerate(similarities):
        if similarity >= similarity_threshold:
            results.append((i, float(similarity), texts[i]))
    
    # Sort by similarity (descending) and limit to top_k
    results.sort(key=lambda x: x[1], reverse=True)
    results = results[:top_k]
    
    return results


def _fallback_text_search(query: str, texts: List[str], top_k: int) -> List[Tuple[int, float, str]]:
    """Fallback to simple text matching if embeddings not available"""
    query_lower = query.lower()
    results = []
    
    for i, text in enumerate(texts):
        text_lower = text.lower()
        if query_lower in text_lower:
            # Simple score: how many times query appears
            score = text_lower.count(query_lower) / max(1, len(text_lower.split()))
            results.append((i, score, text))
    
    # Sort by score and limit
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


def extract_keywords(text: str, lang: str = "auto", max_keywords: int = 10) -> List[str]:
    """
    Extract keywords from text using NLP.
    Returns a list of important keywords (nouns, adjectives, verbs).
    Falls back to simple word extraction if spaCy not available.
    """
    if lang == "auto":
        if re.search(r'[Α-Ωα-ω]', text):
            lang = "el"
        else:
            lang = "en"
    
    nlp = get_nlp_model(lang)
    if nlp is None:
        # Fallback: return common words (remove stopwords manually)
        words = re.findall(r'\b\w+\b', text.lower())
        # Remove very short words and common stopwords
        stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        keywords = [w for w in words if len(w) > 3 and w not in stopwords]
        return keywords[:max_keywords]
    
    try:
        doc = nlp(text)
        keywords = []
        
        # Extract nouns, adjectives, and verbs as keywords
        for token in doc:
            if token.pos_ in ("NOUN", "ADJ", "VERB") and not token.is_stop and not token.is_punct:
                keyword = token.lemma_.lower()
                if len(keyword) > 2:  # Filter very short keywords
                    keywords.append(keyword)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_keywords = []
        for kw in keywords:
            if kw not in seen:
                seen.add(kw)
                unique_keywords.append(kw)
        
        return unique_keywords[:max_keywords]
    except Exception as e:
        logger.warning(f"Error extracting keywords with NLP: {e}. Falling back to simple extraction.")
        # Fallback: return common words (remove stopwords manually)
        words = re.findall(r'\b\w+\b', text.lower())
        stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        keywords = [w for w in words if len(w) > 3 and w not in stopwords]
        return keywords[:max_keywords]


def detect_language(text: str) -> str:
    """Detect language of text (Greek or English)"""
    # Simple heuristic: check for Greek characters
    if re.search(r'[Α-Ωα-ω]', text):
        return "el"
    return "en"


# Export functions for use in API routes
__all__ = [
    "semantic_search",
    "expand_query_with_variations",
    "extract_keywords",
    "detect_language",
    "compute_embeddings",
    "_synonym_manager",
    "get_embedding_model",
    "get_nlp_model",
]
