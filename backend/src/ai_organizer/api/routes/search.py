# backend/src/ai_organizer/api/routes/search.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, text
from typing import List, Optional, Set, Dict
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Segment, User

# Import semantic search service (optional - graceful fallback)
# Catch all exceptions (including ConfigError from spaCy/Pydantic compatibility issues)
# Note: spaCy has compatibility issues with Python 3.14+, so we catch all exceptions
SEMANTIC_SEARCH_AVAILABLE = False
semantic_search_fn = None
expand_query_with_variations = None
detect_language = None
_synonym_manager = None

try:
    # Import the module first to catch any import-time errors (including spacy compatibility issues)
    import ai_organizer.services.semantic_search as semantic_search_module
    
    # Then try to get specific functions/objects (may be None if import failed)
    semantic_search_fn = getattr(semantic_search_module, 'semantic_search', None)
    expand_query_with_variations = getattr(semantic_search_module, 'expand_query_with_variations', None)
    detect_language = getattr(semantic_search_module, 'detect_language', None)
    _synonym_manager = getattr(semantic_search_module, '_synonym_manager', None)
    
    # Check if imports were successful (sentence-transformers is required, spacy is optional)
    if semantic_search_fn is not None and expand_query_with_variations is not None and detect_language is not None and _synonym_manager is not None:
        SEMANTIC_SEARCH_AVAILABLE = True
        import logging
        logging.info("Semantic search service loaded successfully (sentence-transformers available, spacy optional)")
    else:
        import logging
        logging.warning("Semantic search service partially available (some functions missing). "
                       f"semantic_search_fn={semantic_search_fn is not None}, "
                       f"expand_query_with_variations={expand_query_with_variations is not None}, "
                       f"detect_language={detect_language is not None}, "
                       f"_synonym_manager={_synonym_manager is not None}")
except (ImportError, Exception) as e:
    import logging
    logging.warning(f"Semantic search service not available (compatibility issue, e.g., spaCy/Pydantic with Python 3.14+): {e}. "
                   f"Semantic search features will be disabled. "
                   f"Install sentence-transformers for basic semantic search (spaCy optional due to Python 3.14+ compatibility issues). "
                   f"The application will continue to work with FTS5 search only.")

router = APIRouter()


# P3: Helper function to check if soft delete fields exist
def _has_p3_soft_delete_fields() -> bool:
    """Check if P3 soft delete columns (deleted_at) exist in tables"""
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        
        if "documents" not in tables or "segments" not in tables:
            return False
        
        # Check if deleted_at column exists in documents and segments tables
        doc_cols = [c["name"] for c in inspector.get_columns("documents")]
        seg_cols = [c["name"] for c in inspector.get_columns("segments")]
        return "deleted_at" in doc_cols and "deleted_at" in seg_cols
    except Exception:
        # If inspection fails, assume fields don't exist (safe fallback)
        return False


class SearchResultItem(BaseModel):
    id: int
    type: str  # "document" or "segment"
    documentId: int | None = None
    title: str
    content: str
    score: float | None = None
    mode: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]
    total: int
    semantic: bool = False  # Whether semantic search was used
    variations: List[str] = []  # Query variations that were used


@router.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., description="Search query"),
    type: Optional[str] = Query(None, description="Filter by type: 'document' or 'segment'"),
    mode: Optional[str] = Query(None, description="Filter segments by mode: 'qa' or 'paragraphs'"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    semantic: bool = Query(False, description="Enable semantic search (requires sentence-transformers)"),
    lang: Optional[str] = Query(None, description="Language for NLP processing ('auto', 'el', 'en')"),
    expand_variations: bool = Query(True, description="Expand query with variations (plural/singular, synonyms, etc.)"),
    user: User = Depends(get_current_user),
):
    """
    Full-text search across documents and segments.
    
    Uses SQLite FTS5 for fast, relevance-ranked search.
    Optionally uses semantic search with embeddings for more accurate results.
    
    Advanced features (if semantic=True):
    - Keyword variations (plural/singular, tenses, lemmatization)
    - Synonyms (custom + built-in)
    - Multi-language support (Greek, English)
    - Semantic similarity using embeddings
    """
    if not q or not q.strip():
        return SearchResponse(query=q, results=[], total=0, semantic=False, variations=[])
    
    query = q.strip()
    results: List[SearchResultItem] = []
    variations: List[str] = [query]  # Original query is always included
    use_semantic = semantic and SEMANTIC_SEARCH_AVAILABLE and semantic_search_fn is not None
    
    # Detect language if auto (only if semantic search is available)
    if lang is None or lang == "auto":
        if SEMANTIC_SEARCH_AVAILABLE and detect_language is not None:
            try:
                lang = detect_language(query)
            except Exception as e:
                import logging
                logging.warning(f"Error detecting language: {e}. Defaulting to 'en'.")
                lang = "en"
        else:
            lang = "en"
    
    # Expand query with variations if enabled and semantic search is available
    if use_semantic and expand_variations and expand_query_with_variations is not None:
        try:
            variations = expand_query_with_variations(query, lang=lang)
            # Limit variations to avoid too many FTS5 queries
            variations = variations[:5]  # Use top 5 variations
        except Exception as e:
            import logging
            logging.warning(f"Error expanding query variations: {e}")
            variations = [query]
    
    with Session(engine) as session:
        # FTS5 search with variations
        fts_results: Set[int] = set()  # Track document/segment IDs to avoid duplicates
        fts_results_map: dict[tuple[str, int], SearchResultItem] = {}  # (type, id) -> result
        
        # Search documents
        if not type or type == "document":
            # Build FTS5 query with OR for all variations (more efficient than loop)
            # FTS5 supports OR operator: "word1 OR word2 OR word3"
            # Escape special characters and build OR query
            escaped_variations = []
            for variation in variations:
                escaped = variation.replace('"', '""').strip()
                if escaped:
                    # Add quotes if contains spaces
                    if ' ' in escaped:
                        escaped_variations.append(f'"{escaped}"')
                    else:
                        escaped_variations.append(escaped)
            
            # Build OR query: "var1 OR var2 OR var3"
            if len(escaped_variations) > 1:
                fts_query = " OR ".join(escaped_variations)
            elif len(escaped_variations) == 1:
                fts_query = escaped_variations[0]
            else:
                fts_query = query.replace('"', '""')
            
            # Build SQL with P3 soft delete filtering (graceful fallback if column doesn't exist)
            deleted_at_filter = ""
            if _has_p3_soft_delete_fields():
                deleted_at_filter = "AND d.deleted_at IS NULL"
            
            sql = text(f"""
                SELECT 
                    d.id,
                    d.title,
                    d.text as content,
                    bm25(documents_fts) as score
                FROM documents_fts
                JOIN documents d ON documents_fts.id = d.id
                WHERE documents_fts MATCH :query
                  AND d.user_id = :user_id
                  {deleted_at_filter}
                ORDER BY score
                LIMIT :limit OFFSET :offset
            """)
            
            try:
                doc_results = session.exec(
                    sql.bindparams(
                        query=fts_query,
                        user_id=user.id,
                        limit=limit * 2,  # Get more results for merging
                        offset=offset
                    )
                ).all()
                
                for row in doc_results:
                    key = ("document", row.id)
                    if key not in fts_results_map:
                        fts_results_map[key] = SearchResultItem(
                            id=row.id,
                            type="document",
                            documentId=row.id,
                            title=row.title,
                            content=row.content[:500] if row.content else "",
                            score=row.score if hasattr(row, 'score') else None,
                        )
                        fts_results.add(row.id)
            except Exception as e:
                import logging
                logging.warning(f"Error in FTS5 document search: {e}. Falling back to simple query.")
                # Fallback to simple query without variations
                try:
                    fts_query = query.replace('"', '""')
                    doc_results = session.exec(
                        sql.bindparams(
                            query=f'"{fts_query}"' if ' ' in fts_query else fts_query,
                            user_id=user.id,
                            limit=limit,
                            offset=offset
                        )
                    ).all()
                    
                    for row in doc_results:
                        key = ("document", row.id)
                        if key not in fts_results_map:
                            fts_results_map[key] = SearchResultItem(
                                id=row.id,
                                type="document",
                                documentId=row.id,
                                title=row.title,
                                content=row.content[:500] if row.content else "",
                                score=row.score if hasattr(row, 'score') else None,
                            )
                            fts_results.add(row.id)
                except Exception as e2:
                    logging.error(f"Error in fallback FTS5 document search: {e2}")
                    pass
        
        # Search segments
        if not type or type == "segment":
            # Build FTS5 query with OR for all variations (more efficient than loop)
            escaped_variations = []
            for variation in variations:
                escaped = variation.replace('"', '""').strip()
                if escaped:
                    if ' ' in escaped:
                        escaped_variations.append(f'"{escaped}"')
                    else:
                        escaped_variations.append(escaped)
            
            if len(escaped_variations) > 1:
                fts_query = " OR ".join(escaped_variations)
            elif len(escaped_variations) == 1:
                fts_query = escaped_variations[0]
            else:
                fts_query = query.replace('"', '""')
            
            # Build WHERE clause for mode filter and P3 soft delete filtering
            mode_filter = ""
            if mode:
                mode_filter = f"AND segments_fts.mode = '{mode}'"
            
            deleted_at_filter = ""
            if _has_p3_soft_delete_fields():
                deleted_at_filter = "AND d.deleted_at IS NULL AND s.deleted_at IS NULL"
            
            sql = text(f"""
                SELECT 
                    s.id,
                    s.document_id,
                    s.title,
                    s.content,
                    s.mode,
                    bm25(segments_fts) as score
                FROM segments_fts
                JOIN segments s ON segments_fts.id = s.id
                JOIN documents d ON s.document_id = d.id
                WHERE segments_fts MATCH :query
                  AND d.user_id = :user_id
                  {mode_filter}
                  {deleted_at_filter}
                ORDER BY score
                LIMIT :limit OFFSET :offset
            """)
            
            try:
                seg_results = session.exec(
                    sql.bindparams(
                        query=fts_query,
                        user_id=user.id,
                        limit=limit * 2,  # Get more results for merging
                        offset=offset
                    )
                ).all()
                
                for row in seg_results:
                    key = ("segment", row.id)
                    if key not in fts_results_map:
                        fts_results_map[key] = SearchResultItem(
                            id=row.id,
                            type="segment",
                            documentId=row.document_id,
                            title=row.title,
                            content=row.content[:500] if row.content else "",
                            score=row.score if hasattr(row, 'score') else None,
                            mode=row.mode,
                        )
                        fts_results.add(row.id)
            except Exception as e:
                import logging
                logging.warning(f"Error in FTS5 segment search: {e}. Falling back to simple query.")
                # Fallback to simple query without variations
                try:
                    fts_query = query.replace('"', '""')
                    seg_results = session.exec(
                        sql.bindparams(
                            query=f'"{fts_query}"' if ' ' in fts_query else fts_query,
                            user_id=user.id,
                            limit=limit,
                            offset=offset
                        )
                    ).all()
                    
                    for row in seg_results:
                        key = ("segment", row.id)
                        if key not in fts_results_map:
                            fts_results_map[key] = SearchResultItem(
                                id=row.id,
                                type="segment",
                                documentId=row.document_id,
                                title=row.title,
                                content=row.content[:500] if row.content else "",
                                score=row.score if hasattr(row, 'score') else None,
                                mode=row.mode,
                            )
                            fts_results.add(row.id)
                except Exception as e2:
                    logging.error(f"Error in fallback FTS5 segment search: {e2}")
                    pass
        
        # Convert FTS5 results to list
        fts_results_list = list(fts_results_map.values())
        
        # If semantic search is enabled, enhance results with semantic similarity
        if use_semantic and semantic_search_fn is not None:
            try:
                # Get all documents and segments for semantic search (with P3 soft delete filtering)
                doc_query = select(Document).where(Document.user_id == user.id)
                seg_query = select(Segment).join(Document).where(Document.user_id == user.id)
                
                # P3: Filter out soft-deleted documents and segments
                if _has_p3_soft_delete_fields():
                    doc_query = doc_query.where(Document.deleted_at.is_(None))
                    seg_query = seg_query.where(
                        Document.deleted_at.is_(None),
                        Segment.deleted_at.is_(None)
                    )
                
                if mode:
                    seg_query = seg_query.where(Segment.mode == mode)
                
                all_docs = session.exec(doc_query).all() if not type or type == "document" else []
                all_segs = session.exec(seg_query).all() if not type or type == "segment" else []
                
                # Prepare texts for semantic search
                semantic_texts: List[str] = []
                semantic_metadata: List[tuple[str, int]] = []  # (type, id)
                
                for doc in all_docs:
                    text_content = f"{doc.title} {doc.text}" if doc.text else doc.title
                    semantic_texts.append(text_content)
                    semantic_metadata.append(("document", doc.id))
                
                for seg in all_segs:
                    text_content = f"{seg.title} {seg.content}" if seg.content else seg.title
                    semantic_texts.append(text_content)
                    semantic_metadata.append(("segment", seg.id))
                
                # Perform semantic search (only if function is available)
                if semantic_texts and semantic_search_fn is not None:
                    try:
                        semantic_results = semantic_search_fn(
                            query,
                            semantic_texts,
                            top_k=limit * 2,  # Get more results
                            similarity_threshold=0.3,  # Lower threshold for more results
                            expand_variations=False,  # Already expanded above
                            lang=lang
                        )
                        
                        # Merge semantic results with FTS5 results
                        semantic_results_map: dict[tuple[str, int], float] = {}
                        
                        for idx, similarity, _ in semantic_results:
                            result_type, result_id = semantic_metadata[idx]
                            
                            # Skip if filtered by type
                            if type and result_type != type:
                                continue
                            
                            key = (result_type, result_id)
                            semantic_results_map[key] = similarity
                            
                            # If not in FTS5 results, add it
                            if key not in fts_results_map:
                                # Find the original document/segment
                                if result_type == "document":
                                    doc = next((d for d in all_docs if d.id == result_id), None)
                                    if doc:
                                        fts_results_map[key] = SearchResultItem(
                                            id=doc.id,
                                            type="document",
                                            documentId=doc.id,
                                            title=doc.title,
                                            content=doc.text[:500] if doc.text else "",
                                            score=similarity,  # Use semantic similarity as score
                                        )
                                elif result_type == "segment":
                                    seg = next((s for s in all_segs if s.id == result_id), None)
                                    if seg:
                                        fts_results_map[key] = SearchResultItem(
                                            id=seg.id,
                                            type="segment",
                                            documentId=seg.document_id,
                                            title=seg.title,
                                            content=seg.content[:500] if seg.content else "",
                                            score=similarity,  # Use semantic similarity as score
                                            mode=seg.mode,
                                        )
                        
                        # Boost FTS5 scores with semantic similarity (weighted average)
                        for key, result in fts_results_map.items():
                            if key in semantic_results_map:
                                semantic_score = semantic_results_map[key]
                                fts_score = result.score if result.score is not None else 0
                                # Weighted average: 70% FTS5, 30% semantic (adjustable)
                                result.score = 0.7 * fts_score + 0.3 * semantic_score
                        
                        # Re-sort by combined score
                        fts_results_list = list(fts_results_map.values())
                        fts_results_list.sort(key=lambda x: x.score if x.score is not None else 0, reverse=True)
                    except Exception as e2:
                        import logging
                        logging.warning(f"Error in semantic search function: {e2}. Falling back to FTS5 only.")
                        use_semantic = False
            except Exception as e:
                import logging
                logging.warning(f"Error in semantic search setup: {e}. Falling back to FTS5 only.")
                use_semantic = False
        
        # Sort by score and limit
        fts_results_list.sort(key=lambda x: x.score if x.score is not None else 0, reverse=True)
        results = fts_results_list[offset:offset + limit]
        
        # Get total count
        total = len(fts_results_list)
    
    return SearchResponse(
        query=query,
        results=results,
        total=total,
        semantic=use_semantic,
        variations=variations[:5] if use_semantic and expand_variations else [query]
    )


# ============================================================================
# Custom Synonyms Management Endpoints
# ============================================================================

class SynonymPair(BaseModel):
    word: str
    synonym: str


class SynonymListResponse(BaseModel):
    synonyms: Dict[str, List[str]]  # word -> list of synonyms


class SynonymResponse(BaseModel):
    ok: bool
    word: str
    synonym: str
    message: str = ""


@router.post("/search/synonyms", response_model=SynonymResponse)
def add_synonym(
    pair: SynonymPair,
    user: User = Depends(get_current_user),
):
    """
    Add a custom synonym pair (bidirectional).
    
    Example: {"word": "document", "synonym": "file"}
    This will make "document" and "file" synonyms in search.
    """
    if not SEMANTIC_SEARCH_AVAILABLE or _synonym_manager is None:
        raise HTTPException(
            status_code=501,
            detail="Semantic search not available. Install sentence-transformers and spacy."
        )
    
    try:
        _synonym_manager.add_synonym(pair.word, pair.synonym)
        return SynonymResponse(
            ok=True,
            word=pair.word,
            synonym=pair.synonym,
            message=f"Added synonym pair: {pair.word} <-> {pair.synonym}"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error adding synonym: {str(e)}")


@router.delete("/search/synonyms", response_model=SynonymResponse)
def remove_synonym(
    word: str = Query(..., description="First word of synonym pair"),
    synonym: str = Query(..., description="Second word of synonym pair"),
    user: User = Depends(get_current_user),
):
    """
    Remove a custom synonym pair (bidirectional).
    """
    if not SEMANTIC_SEARCH_AVAILABLE or _synonym_manager is None:
        raise HTTPException(
            status_code=501,
            detail="Semantic search not available. Install sentence-transformers and spacy."
        )
    
    try:
        _synonym_manager.remove_synonym(word, synonym)
        return SynonymResponse(
            ok=True,
            word=word,
            synonym=synonym,
            message=f"Removed synonym pair: {word} <-> {synonym}"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error removing synonym: {str(e)}")


@router.get("/search/synonyms", response_model=SynonymListResponse)
def list_synonyms(
    word: Optional[str] = Query(None, description="Get synonyms for a specific word (optional)"),
    user: User = Depends(get_current_user),
):
    """
    List all custom synonyms.
    
    If `word` is provided, returns synonyms for that specific word.
    Otherwise, returns all custom synonyms.
    """
    if not SEMANTIC_SEARCH_AVAILABLE or _synonym_manager is None:
        raise HTTPException(
            status_code=501,
            detail="Semantic search not available. Install sentence-transformers and spacy."
        )
    
    try:
        if word:
            # Return synonyms for specific word
            synonyms = _synonym_manager.get_synonyms(word)
            return SynonymListResponse(
                synonyms={word: list(synonyms)}
            )
        else:
            # Return all custom synonyms
            all_synonyms: Dict[str, List[str]] = {}
            for word, syns in _synonym_manager.custom_synonyms.items():
                all_synonyms[word] = list(syns)
            return SynonymListResponse(synonyms=all_synonyms)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error listing synonyms: {str(e)}")

