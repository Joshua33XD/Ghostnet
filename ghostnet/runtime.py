"""Runtime compatibility settings for GhostNet processes."""
from __future__ import annotations

import asyncio
import os


def configure_event_loop() -> None:
    """Avoid noisy Proactor socket-reset callbacks on Windows clients."""
    if os.name != "nt":
        return
    selector_policy = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
    if selector_policy is not None:
        asyncio.set_event_loop_policy(selector_policy())
