# backend/src/ai_organizer/services/purge_service.py
"""P3: Retention Policy & Purge Service

Automatically purges soft-deleted items older than retention period.
"""

from datetime import datetime, timedelta
from typing import Dict, List
import logging

from sqlmodel import Session, select
from sqlalchemy import func

from ai_organizer.core.db import engine
from ai_organizer.models import Document, Segment, Folder
from ai_organizer.core.config import settings

logger = logging.getLogger(__name__)


class PurgeService:
    """Service for managing retention policy and purging deleted items."""
    
    def __init__(self):
        self.retention_days = settings.AIORG_RETENTION_DAYS
        self.purge_enabled = settings.AIORG_PURGE_ENABLED
        self.purge_interval_hours = settings.AIORG_PURGE_INTERVAL_HOURS
        
        logger.info(f"Purge Service initialized: retention={self.retention_days} days, "
                   f"enabled={self.purge_enabled}, interval={self.purge_interval_hours}h")
    
    def get_cutoff_date(self) -> datetime:
        """Get the cutoff date for purging (retention period ago)."""
        return datetime.utcnow() - timedelta(days=self.retention_days)
    
    def purge_expired_items(self) -> Dict[str, int]:
        """Purge all soft-deleted items older than retention period.
        
        Returns:
            Dict with counts of purged items by type.
        """
        if not self.purge_enabled:
            logger.info("Purge is disabled, skipping")
            return {"documents": 0, "segments": 0, "folders": 0}
        
        cutoff_date = self.get_cutoff_date()
        logger.info(f"Purging items deleted before {cutoff_date.isoformat()}")
        
        results = {
            "documents": self._purge_expired_documents(cutoff_date),
            "segments": self._purge_expired_segments(cutoff_date),
            "folders": self._purge_expired_folders(cutoff_date),
        }
        
        total_purged = sum(results.values())
        logger.info(f"Purge completed: {total_purged} items purged ({results})")
        
        return results
    
    def _purge_expired_documents(self, cutoff_date: datetime) -> int:
        """Purge expired documents."""
        with Session(engine) as session:
            # Find expired documents
            expired_docs = session.exec(
                select(Document).where(
                    Document.deleted_at.isnot(None),
                    Document.deleted_at < cutoff_date
                )
            ).all()
            
            count = len(expired_docs)
            if count == 0:
                return 0
            
            logger.info(f"Purging {count} expired documents")
            
            # Delete documents (cascade will handle related records)
            for doc in expired_docs:
                session.delete(doc)
            
            session.commit()
            return count
    
    def _purge_expired_segments(self, cutoff_date: datetime) -> int:
        """Purge expired segments."""
        with Session(engine) as session:
            # Find expired segments
            expired_segments = session.exec(
                select(Segment).where(
                    Segment.deleted_at.isnot(None),
                    Segment.deleted_at < cutoff_date
                )
            ).all()
            
            count = len(expired_segments)
            if count == 0:
                return 0
            
            logger.info(f"Purging {count} expired segments")
            
            # Delete segments
            for segment in expired_segments:
                session.delete(segment)
            
            session.commit()
            return count
    
    def _purge_expired_folders(self, cutoff_date: datetime) -> int:
        """Purge expired folders."""
        with Session(engine) as session:
            # Find expired folders
            expired_folders = session.exec(
                select(Folder).where(
                    Folder.deleted_at.isnot(None),
                    Folder.deleted_at < cutoff_date
                )
            ).all()
            
            count = len(expired_folders)
            if count == 0:
                return 0
            
            logger.info(f"Purging {count} expired folders")
            
            # Delete folders (cascade will handle related records)
            for folder in expired_folders:
                session.delete(folder)
            
            session.commit()
            return count
    
    def get_retention_stats(self) -> Dict[str, any]:
        """Get statistics about deleted items and retention policy."""
        with Session(engine) as session:
            cutoff_date = self.get_cutoff_date()
            
            # Count items by deletion status
            doc_stats = session.exec(
                select(
                    func.count(Document.id).label('total'),
                    func.count(Document.id).filter(Document.deleted_at.isnot(None)).label('deleted'),
                    func.count(Document.id).filter(Document.deleted_at < cutoff_date).label('expired')
                ).where(Document.deleted_at.isnot(None))
            ).first() or (0, 0, 0)
            
            seg_stats = session.exec(
                select(
                    func.count(Segment.id).label('total'),
                    func.count(Segment.id).filter(Segment.deleted_at.isnot(None)).label('deleted'),
                    func.count(Segment.id).filter(Segment.deleted_at < cutoff_date).label('expired')
                ).where(Segment.deleted_at.isnot(None))
            ).first() or (0, 0, 0)
            
            folder_stats = session.exec(
                select(
                    func.count(Folder.id).label('total'),
                    func.count(Folder.id).filter(Folder.deleted_at.isnot(None)).label('deleted'),
                    func.count(Folder.id).filter(Folder.deleted_at < cutoff_date).label('expired')
                ).where(Folder.deleted_at.isnot(None))
            ).first() or (0, 0, 0)
            
            return {
                "retention_days": self.retention_days,
                "purge_enabled": self.purge_enabled,
                "purge_interval_hours": self.purge_interval_hours,
                "cutoff_date": cutoff_date.isoformat(),
                "documents": {
                    "deleted": doc_stats[1],
                    "expired": doc_stats[2],
                },
                "segments": {
                    "deleted": seg_stats[1],
                    "expired": seg_stats[2],
                },
                "folders": {
                    "deleted": folder_stats[1],
                    "expired": folder_stats[2],
                },
                "total_expired": doc_stats[2] + seg_stats[2] + folder_stats[2],
            }
    
    def manual_purge(self, days: int = None) -> Dict[str, int]:
        """Manually purge items older than specified days (or retention period if None)."""
        original_retention = self.retention_days
        
        if days is not None:
            self.retention_days = days
            logger.info(f"Manual purge with custom retention: {days} days")
        
        try:
            results = self.purge_expired_items()
            return results
        finally:
            # Restore original retention
            self.retention_days = original_retention


# Global purge service instance
purge_service = PurgeService()
