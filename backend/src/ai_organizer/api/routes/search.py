# backend/src/ai_organizer/api/routes/search.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, text
from typing import List, Optional

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Segment, User

router = APIRouter()


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


@router.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., description="Search query"),
    type: Optional[str] = Query(None, description="Filter by type: 'document' or 'segment'"),
    mode: Optional[str] = Query(None, description="Filter segments by mode: 'qa' or 'paragraphs'"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    user: User = Depends(get_current_user),
):
    """
    Full-text search across documents and segments.
    
    Uses SQLite FTS5 for fast, relevance-ranked search.
    """
    if not q or not q.strip():
        return SearchResponse(query=q, results=[], total=0)
    
    query = q.strip()
    results: List[SearchResultItem] = []
    
    with Session(engine) as session:
        # Search documents
        if not type or type == "document":
            # Escape special FTS5 characters and build query
            # FTS5 uses double quotes for phrases, so we need to escape them
            fts_query = query.replace('"', '""')
            
            # Use FTS5 match with ranking
            sql = text("""
                SELECT 
                    d.id,
                    d.title,
                    d.text as content,
                    bm25(documents_fts) as score
                FROM documents_fts
                JOIN documents d ON documents_fts.id = d.id
                WHERE documents_fts MATCH :query
                  AND d.user_id = :user_id
                ORDER BY score
                LIMIT :limit OFFSET :offset
            """)
            
            doc_results = session.exec(
                sql.bindparams(
                    query=f'"{fts_query}"' if ' ' in fts_query else fts_query,
                    user_id=user.id,
                    limit=limit,
                    offset=offset
                )
            ).all()
            
            for row in doc_results:
                results.append(SearchResultItem(
                    id=row.id,
                    type="document",
                    documentId=row.id,
                    title=row.title,
                    content=row.content[:500] if row.content else "",  # Preview
                    score=row.score if hasattr(row, 'score') else None,
                ))
        
        # Search segments
        if not type or type == "segment":
            fts_query = query.replace('"', '""')
            
            # Build WHERE clause for mode filter
            mode_filter = ""
            if mode:
                mode_filter = f"AND segments_fts.mode = '{mode}'"
            
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
                ORDER BY score
                LIMIT :limit OFFSET :offset
            """)
            
            seg_results = session.exec(
                sql.bindparams(
                    query=f'"{fts_query}"' if ' ' in fts_query else fts_query,
                    user_id=user.id,
                    limit=limit,
                    offset=offset
                )
            ).all()
            
            for row in seg_results:
                results.append(SearchResultItem(
                    id=row.id,
                    type="segment",
                    documentId=row.document_id,
                    title=row.title,
                    content=row.content[:500] if row.content else "",  # Preview
                    score=row.score if hasattr(row, 'score') else None,
                    mode=row.mode,
                ))
        
        # Sort by score (if available) and limit
        results.sort(key=lambda x: x.score if x.score is not None else 0, reverse=True)
        results = results[:limit]
        
        # Get total count (simplified - could be optimized)
        total = len(results)
    
    return SearchResponse(query=query, results=results, total=total)

