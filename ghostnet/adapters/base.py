# =============================================================================
# GhostNet — adapters/base.py
# Abstract device adapter interface.
# When you have real IoT device code, create a subclass here and plug it in.
# =============================================================================
from __future__ import annotations
from abc import ABC, abstractmethod


class DeviceAdapter(ABC):
    """
    Abstract base for all connection adapters.

    To add real IoT device code:
      1. Subclass DeviceAdapter
      2. Implement on_telemetry / on_heartbeat / send_command
      3. Register your adapter in engine.py

    All adapters funnel data into the shared StateStore — detection and
    response work identically regardless of connection type.
    """

    @abstractmethod
    def connect(self) -> None:
        """Establish the connection."""

    @abstractmethod
    def disconnect(self) -> None:
        """Tear down the connection."""

    @abstractmethod
    def publish(self, topic: str, payload: str) -> None:
        """Send a command to the device."""
