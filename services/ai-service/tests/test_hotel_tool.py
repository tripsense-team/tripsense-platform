import asyncio
from datetime import date, timedelta
import pytest
from pydantic import ValidationError
from app.config import Settings
from app.tools import SearchHotelsInput, ToolExecutor, ToolExecutionError


def criteria():
    return {"destination": "Da Nang", "checkIn": str(date.today() + timedelta(days=4)),
            "checkOut": str(date.today() + timedelta(days=6)), "guests": 2, "quantity": 1}


def test_missing_occupancy_and_unknown_provider_url_rejected():
    with pytest.raises(ValidationError):
        SearchHotelsInput.model_validate({"destination": "Da Nang"})
    with pytest.raises(ValidationError):
        SearchHotelsInput.model_validate({**criteria(), "url": "https://attacker.test"})


def test_hotel_search_only_uses_authenticated_gateway_and_preserves_evidence(monkeypatch):
    executor = ToolExecutor(Settings(hotel_gateway_url="http://gateway.test"), "private-token")
    row = {"property_id": "hotel-id", "room_type_id": "room-id", "name": "Hotel", "room_name": "Double",
           "total": 1000000, "currency": "VND", "checked_at": "2026-09-27T00:00:00Z", "available_rooms": 1}
    async def get(client, url, params=None, headers=None):
        assert url == "http://gateway.test/api/hotels/search"
        assert headers == {"Authorization": "Bearer private-token"}
        assert params == criteria()
        return {"success": True, "data": [row]}
    monkeypatch.setattr(executor, "_get", get)
    result = asyncio.run(executor.execute("search_hotels", criteria()))
    assert result.artifact["type"] == "HOTEL_LIST"
    assert result.data["hotels"] == [row]
    assert result.data["bookingRequiresRevalidation"] is True
    assert "private-token" not in str(result.artifact)
    assert result.provenance["provider"] == "trip-service"


def test_provider_failure_is_not_returned_as_no_inventory(monkeypatch):
    executor = ToolExecutor(Settings(), "token")
    async def broken(*args, **kwargs):
        return {"success": True, "data": [{"name": "unverified"}]}
    monkeypatch.setattr(executor, "_get", broken)
    with pytest.raises(ToolExecutionError, match="Incomplete hotel search evidence"):
        asyncio.run(executor.execute("search_hotels", criteria()))
