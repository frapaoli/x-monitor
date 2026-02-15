import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from scraper.service import ScraperService

logger = logging.getLogger(__name__)


def setup_scheduler(scraper_service: ScraperService, interval_minutes: int) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        scraper_service.poll_all_accounts,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="poll_all_accounts",
        replace_existing=True,
        max_instances=1,
    )
    logger.info(f"Scheduler configured with {interval_minutes}-minute interval")
    return scheduler


def reschedule(scheduler: AsyncIOScheduler, interval_minutes: int) -> None:
    scheduler.reschedule_job(
        "poll_all_accounts",
        trigger=IntervalTrigger(minutes=interval_minutes),
    )
    logger.info(f"Scheduler rescheduled to {interval_minutes}-minute interval")
