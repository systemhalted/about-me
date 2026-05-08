#!/usr/bin/env python3
import argparse
import datetime
import email.utils
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET

SOURCES = [
    {
        "id": "systemhalted",
        "name": "System Halted",
        "site_url": "https://systemhalted.in",
        "feed_urls": [
            "https://systemhalted.in/feed",
            "https://systemhalted.in/feed.xml",
            "https://systemhalted.in/rss.xml",
            "https://systemhalted.in/index.xml",
        ],
    },
    {
        "id": "substack",
        "name": "Substack",
        "site_url": "https://palakmathur.substack.com",
        "feed_urls": ["https://palakmathur.substack.com/feed"],
    },
    {
        "id": "goodreads",
        "name": "Goodreads",
        "site_url": "https://www.goodreads.com/user/show/1863824-palak-mathur",
        "feed_urls": ["https://www.goodreads.com/user/updates_rss/1863824"],
    },
]


BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_feed(url):
    request = urllib.request.Request(url, headers=BROWSER_HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def strip_ns(tag):
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def find_text_by_local_name(element, names):
    for child in element:
        if strip_ns(child.tag) in names and child.text:
            return child.text.strip()
    return ""


def find_link(element):
    for child in element:
        if strip_ns(child.tag) != "link":
            continue
        href = child.attrib.get("href")
        if href:
            return href
        if child.text:
            return child.text.strip()
    return ""


def parse_date(value):
    if not value:
        return ""
    value = value.strip()
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=datetime.timezone.utc)
        return parsed.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError):
        pass
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=datetime.timezone.utc)
        return parsed.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return ""


def parse_rss(channel, limit):
    items = []
    for item in channel.findall("item"):
        title = find_text_by_local_name(item, ["title"])
        link = find_text_by_local_name(item, ["link"]) or find_link(item)
        published = find_text_by_local_name(item, ["pubDate", "date", "published"])
        items.append({
            "title": title,
            "url": link,
            "published": parse_date(published),
        })
        if len(items) >= limit:
            break
    return items


def parse_atom(feed, limit):
    items = []
    for entry in feed.findall(".//{http://www.w3.org/2005/Atom}entry") or feed.findall("entry"):
        title = find_text_by_local_name(entry, ["title"])
        link = find_link(entry)
        published = find_text_by_local_name(entry, ["published", "updated"])
        items.append({
            "title": title,
            "url": link,
            "published": parse_date(published),
        })
        if len(items) >= limit:
            break
    return items


def parse_feed(xml_bytes, limit):
    root = ET.fromstring(xml_bytes)
    root_tag = strip_ns(root.tag)
    if root_tag == "rss":
        channel = root.find("channel")
        if channel is None:
            return []
        return parse_rss(channel, limit)
    if root_tag == "feed":
        return parse_atom(root, limit)
    channel = root.find("channel")
    if channel is not None:
        return parse_rss(channel, limit)
    return []


def load_previous(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return {}
    previous = {}
    for source in data.get("sources", []):
        if "id" in source:
            previous[source["id"]] = source
    return previous


def build_sources(limit, previous):
    results = []
    for source in SOURCES:
        feed_content = None
        feed_url = ""
        last_error = None
        for candidate in source["feed_urls"]:
            try:
                feed_content = fetch_feed(candidate)
                feed_url = candidate
                break
            except Exception as exc:
                last_error = exc
                continue

        if feed_content is None:
            prior = previous.get(source["id"])
            if prior is not None:
                print(
                    f"Warning: unable to fetch feed for {source['name']} "
                    f"({last_error}); reusing previous items.",
                    file=sys.stderr,
                )
                results.append({
                    "id": source["id"],
                    "name": source["name"],
                    "url": source["site_url"],
                    "feed_url": prior.get("feed_url", source["feed_urls"][0]),
                    "items": prior.get("items", []),
                })
                continue
            raise ValueError(f"Unable to fetch feed for {source['name']}")

        items = parse_feed(feed_content, limit)
        items = [item for item in items if item["title"] and item["url"]]
        results.append({
            "id": source["id"],
            "name": source["name"],
            "url": source["site_url"],
            "feed_url": feed_url,
            "items": items,
        })
    return results


def write_output(path, sources):
    updated_at = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = {
        "updated_at": updated_at,
        "sources": sources,
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2)
        handle.write("\n")


def main():
    parser = argparse.ArgumentParser(description="Build latest source items from RSS feeds.")
    parser.add_argument("--output", default="_data/latest_sources.json")
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()

    previous = load_previous(args.output)
    sources = build_sources(args.limit, previous)
    write_output(args.output, sources)
    print(f"Wrote {len(sources)} sources to {args.output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
