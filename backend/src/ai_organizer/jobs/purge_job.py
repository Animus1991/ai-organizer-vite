# backend/src/ai_organizer/jobs/purge_job.py
"""P3: Scheduled Purge Job

Background job that automatically purges expired items.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from ai_organizer.services.purge_service import purge_service
from ai_organizer.core.config import settings

logger = logging.getLogger(__name__)


class PurgeJob:
    """Scheduled job for automatic purging of expired items."""
    
    def __init__(self):
        self.is_running = False
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.task: Optional[asyncio.Task] = None
        
        # Calculate initial next run time
        self._schedule_next_run()
        
        logger.info(f"Purge job initialized: next run at {self.next_run.isoformat()}")
    
    def _schedule_next_run(self):
        """Schedule the next run time based on interval."""
        if settings.AIORG_PURGE_ENABLED:
            interval_hours = settings.AIORG_PURGE_INTERVAL_HOURS
            self.next_run = datetime.utcnow() + timedelta(hours=interval_hours)
        else:
            self.next_run = None
            logger.info("Purge job disabled (AIORG_PURGE_ENABLED=false)")
    
    async def start(self):
        """Start the scheduled purge job."""
        if self.is_running:
            logger.warning("Purge job is already running")
            return
        
        self.is_running = True
        logger.info("Starting scheduled purge job")
        
        # Create the background task
        self.task = asyncio.create_task(self._run_scheduler())
    
    async def stop(self):
        """Stop the scheduled purge job."""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("Stopping scheduled purge job")
        
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
    
    async def _run_scheduler(self):
        """Main scheduler loop."""
        while self.is_running:
            try:
                # Check if it's time to run
                if self.next_run and datetime.utcnow() >= self.next_run:
                    await self._execute_purge()
                    self._schedule_next_run()
                
                # Sleep for a short interval before checking again
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                logger.info("Purge job cancelled")
                break
            except Exception as e:
                logger.error(f"Error in purge job scheduler: {e}")
                # Schedule next run even if there was an error
                self._schedule_next_run()
                await asyncio.sleep(300)  # Wait 5 minutes before retrying
    
    async def _execute_purge(self):
        """Execute the purge operation."""
        try:
            logger.info("Executing scheduled purge")
            self.last_run = datetime.utcnow()
            
            results = purge_service.purge_expired_items()
            total_purged = sum(results.values())
            
            if total_purged > 0:
                logger.info(f"Scheduled purge completed: {total_purged} items purged ({results})")
            else:
                logger.info("Scheduled purge completed: no expired items found")
                
        except Exception as e:
            logger.error(f"Error during scheduled purge: {e}")
    
    def get_status(self) -> dict:
        """Get current job status."""
        return {
            "is_running": self.is_running,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "purge_enabled": settings.AIORG_PURGE_ENABLED,
            "retention_days": settings.AIORG_RETENTION_DAYS,
            "interval_hours": settings.AIORG_PURGE_INTERVAL_HOURS,
        }
    
    async def run_now(self) -> dict:
        """Manually trigger a purge run."""
        if self.is_running:
            logger.info("Manual purge trigger (job is running)")
            await self._execute_purge()
            return {"message": "Manual purge completed", "status": "completed"}
        else:
            logger.info("Manual purge trigger (job not running)")
            await self._execute_purge()
            return {"message": "Manual purge completed", "status": "completed"}


# Global purge job instance
purge_job = PurgeJob()
