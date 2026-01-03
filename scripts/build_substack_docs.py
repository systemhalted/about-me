#!/usr/bin/env python3
import argparse
import datetime
import html
import json
import re
import socket
import sys
import urllib.request
import xml.etree.ElementTree as ET

FEED_URL = "https://palakmathur.substack.com/feed"
OUTPUT_PATH = "js/substack-docs.js"

CONTENT_NS = {"content": "http://purl.org/rss/1.0/modules/content/"}


def force_ipv4():
    original_getaddrinfo = socket.getaddrinfo

    def getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        return original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = getaddrinfo


def fetch_feed(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def clean_text(raw_text):
    if not raw_text:
        return ""
    text = html.unescape(raw_text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_feed(xml_bytes):
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("Missing channel in feed")

    docs = []
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        guid = (item.findtext("guid") or link).strip()
        raw_content = item.findtext("content:encoded", default="", namespaces=CONTENT_NS)
        if not raw_content:
            raw_content = item.findtext("description") or ""
        content = clean_text(raw_content)

        if not title or not link:
            continue

        doc_id = "substack-" + guid
        docs.append({
            "id": doc_id,
            "title": title,
            "link": link,
            "content": content,
            "source": "Substack",
        })
    return docs


def write_js(path, docs):
    updated_at = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = json.dumps(docs, ensure_ascii=True, indent=2)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("window.substackDocsUpdatedAt = \"" + updated_at + "\";\n")
        handle.write("window.substackDocs = ")
        handle.write(payload)
        handle.write(";\n")


def main():
    parser = argparse.ArgumentParser(description="Build Substack search docs from the RSS feed.")
    parser.add_argument("--feed-url", default=FEED_URL)
    parser.add_argument("--output", default=OUTPUT_PATH)
    args = parser.parse_args()

    force_ipv4()
    xml_bytes = fetch_feed(args.feed_url)
    docs = parse_feed(xml_bytes)
    if not docs:
        raise ValueError("No docs found in feed")
    write_js(args.output, docs)
    print(f"Wrote {len(docs)} entries to {args.output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
