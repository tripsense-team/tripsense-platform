"""Bounded, search-result-only web research. Web text is evidence, never instructions."""
import asyncio
import ipaddress
import socket
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit

import httpx


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def _public_https(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Only public HTTPS search results can be opened")
    return parsed.hostname


async def _verify_host(url: str) -> str:
    hostname = _public_https(url)
    addresses = await asyncio.to_thread(socket.getaddrinfo, hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError("Search result does not resolve to a public address")
    return addresses[0][4][0]


class WebResearch:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.results: dict[str, dict] = {}
        self.queries: set[str] = set()
        self.opened: set[str] = set()

    async def search(self, query: str, gap: str, limit: int = 5) -> list[dict]:
        if not self.api_key:
            raise ValueError("Web research is not configured")
        normalized = " ".join(query.casefold().split())
        if normalized in self.queries:
            return []
        self.queries.add(normalized)
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.get("https://api.search.brave.com/res/v1/web/search",
                                        params={"q": query[:200], "count": min(max(limit, 1), 5), "safesearch": "strict"},
                                        headers={"X-Subscription-Token": self.api_key, "Accept": "application/json"})
            response.raise_for_status()
            if len(response.content) > 131_072:
                raise ValueError("Web search response too large")
            raw = response.json()
        output = []
        for item in (raw.get("web") or {}).get("results", [])[:5]:
            url = str(item.get("url") or "")
            try:
                _public_https(url)
            except ValueError:
                continue
            result_id = f"web-{len(self.results) + 1}"
            value = {"resultId": result_id, "sourceUrl": url, "title": str(item.get("title") or "")[:180],
                     "publisher": urlsplit(url).hostname, "publishedAt": None,
                     "sourceAge": item.get("age"),
                     "retrievedAt": datetime.now(timezone.utc).isoformat(),
                     "excerpt": str(item.get("description") or "")[:1200], "claimTypes": [gap]}
            self.results[result_id] = value
            output.append(value)
        return output

    async def open(self, result_id: str) -> dict:
        result = self.results.get(result_id)
        if not result or result_id in self.opened:
            raise ValueError("Unknown or already opened search result")
        self.opened.add(result_id)
        url = result["sourceUrl"]
        pinned_ip = await _verify_host(url)
        hostname = urlsplit(url).hostname
        # Connect to the checked IP itself, retaining the original host for
        # HTTP and TLS validation. This closes the DNS rebinding gap.
        async with httpx.AsyncClient(timeout=8, follow_redirects=False, trust_env=False) as client:
            request = client.build_request("GET", url, headers={"Accept": "text/html,text/plain", "Host": hostname})
            request.extensions["sni_hostname"] = hostname
            request.url = request.url.copy_with(host=pinned_ip)
            async with client.stream(request.method, request.url, headers=request.headers,
                                     extensions=request.extensions) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";")[0].lower()
                if content_type not in {"text/html", "text/plain"}:
                    raise ValueError("Unsupported web result content type")
                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > 65_536:
                        raise ValueError("Web result too large")
        content = chunks.decode("utf-8", errors="replace")
        if content_type == "text/html":
            parser = _Text()
            parser.feed(content)
            content = " ".join(parser.parts)
        return {**result, "excerpt": " ".join(content.split())[:6000]}
