#!/usr/bin/env python3
"""
OpenVault Log/Dump Token Trimmer

Reduces token count in logs and debug dumps by removing repetitive noise:
- [OpenVault] prefix
- deps.js:XX timestamp prefix
- embedding_b64 base64 vectors
- Verbose Profile/Max Tokens/Messages lines
- Stack traces from browser internals

Usage:
    python trim-logs.py log11.md dump11.md
    python trim-logs.py log*.md  # process multiple files
    python trim-logs.py --all    # process all log*.md and dump*.md in tmp/
    python trim-logs.py --all --aggressive  # maximum trimming (removes injectedContext)

Options:
    --aggressive    Remove more content (injectedContext, UUID shortening)
    --stats         Just show stats without writing files
"""

import re
import sys
import json
from pathlib import Path
from typing import Optional


def trim_log_file(content: str, aggressive: bool = False) -> str:
    """
    Trim a log file (text format from browser console).

    Removes:
    - deps.js:XX prefix
    - [OpenVault] prefix
    - Verbose Profile/Max Tokens/Messages lines
    - Collapsed object references like (3) [{…}, {…}, {…}]
    - Empty lines excess
    - In aggressive mode: UUIDs shortened, character counts removed
    """
    lines = content.split('\n')
    trimmed_lines = []

    # Patterns to skip entirely
    skip_patterns = [
        r'^Profile:\s*[a-f0-9-]{36}$',  # Profile: UUID
        r'^Max Tokens:\s*\d+$',          # Max Tokens: 8000
        r'^Messages:\s*\(\d+\)\s*\[{…}', # Messages: (3) [{…}, {…}, {…}]
        r'^getStatusOpen @',             # Stack trace
        r'^await in getStatusOpen',
        r'^onConnectButtonClick @',
        r'^dispatch @',
        r'^v\.handle @',
        r'^trigger @',
        r'^\(anonymous\) @',
        r'^each @',
        r'^handleMouseUp_',
        r'^reconnectOpenAi @',
        r'^setProxyPreset @',
        r'^onProxyPresetChange @',
        r'^runProxyCallback @',
        r'^applyConnectionProfile @',
        r'^script\.js:\d+',
        r'^openai\.js:\d+',
        r'^slash-commands\.js:\d+',
        r'^preset-manager\.js:\d+',
        r'^index\.js:\d+',
        r'^\(index\):\d+',
        r'AbortReason\s*\{reason:',
        r'^Clicked stop button',
        r'^Generate entered',
        r'^Core/all messages:',
        r'^skipWIAN not active',
        r'^Rendered \d+ messages',
        r'^Connection successful',
        r'^Set model to',
        r'^Chat load cooldown',
        r'^Chat changed, clearing',
        r'^Extension enabled',
        r'^Generation ended, clearing lock',
    ]

    # Compile skip patterns
    skip_re = [re.compile(p) for p in skip_patterns]

    for line in lines:
        # Remove deps.js:XX prefix
        line = re.sub(r'^deps\.js:\d+\s*', '', line)

        # Remove [OpenVault] prefix
        line = re.sub(r'^\[OpenVault\]\s*', '', line)

        if aggressive:
            # Shorten UUIDs to first 8 chars
            line = re.sub(
                r'([a-f0-9]{8})[a-f0-9-]{28}',
                r'\1...',
                line
            )
            # Remove "LLM response received (X chars)" - redundant with actual response
            if re.match(r'^LLM response received \(\d+ chars\)', line):
                continue
            # Remove "Using ConnectionManagerRequestService" lines
            if 'Using ConnectionManagerRequestService' in line:
                continue

        # Check if line should be skipped
        should_skip = False
        for pattern in skip_re:
            if pattern.search(line):
                should_skip = True
                break

        if should_skip:
            continue

        # Trim trailing whitespace
        line = line.rstrip()

        # Skip empty lines (but keep some structure)
        if not line:
            continue

        trimmed_lines.append(line)

    # Collapse multiple consecutive empty-ish lines
    result = '\n'.join(trimmed_lines)

    # Collapse 3+ newlines to 2
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result


def trim_dump_file(content: str, aggressive: bool = False) -> str:
    """
    Trim a debug dump file (JSON format).

    Removes:
    - embedding_b64 fields (base64 vectors, massive)
    - _descriptionTokens fields (internal counts)
    - embedding_b64 in edges
    - Consolidates whitespace

    In aggressive mode also removes:
    - injectedContext (assembled from events anyway)
    - injectedWorldContext (assembled from communities)
    - embeddingQuery (duplicates entities)
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        # If not valid JSON, return as-is with a warning
        return f"# WARNING: Invalid JSON - {e}\n\n{content}"

    def remove_embeddings(obj, path=""):
        """Recursively remove embedding_b64 and _descriptionTokens fields."""
        if isinstance(obj, dict):
            # Remove specific keys
            keys_to_remove = ['embedding_b64', '_descriptionTokens']

            # In aggressive mode, also remove verbose assembled fields
            if aggressive:
                # injectedContext is huge and assembled from events/reflections
                if 'injectedContext' in obj:
                    # Replace with placeholder showing token count
                    ctx = obj.get('injectedContext', '')
                    obj['injectedContext'] = f"<{len(ctx)} chars - trimmed>"
                if 'injectedWorldContext' in obj:
                    ctx = obj.get('injectedWorldContext', '')
                    obj['injectedWorldContext'] = f"<{len(ctx)} chars - trimmed>"

            for key in keys_to_remove:
                if key in obj:
                    del obj[key]

            # Recurse into values
            for key, value in list(obj.items()):
                obj[key] = remove_embeddings(value, f"{path}.{key}")

        elif isinstance(obj, list):
            obj = [remove_embeddings(item, f"{path}[]") for item in obj]

        return obj

    data = remove_embeddings(data)

    # Output with compact but readable formatting
    return json.dumps(data, indent=2, ensure_ascii=False)


def detect_file_type(content: str, filename: str) -> str:
    """Detect if file is a log (text) or dump (JSON)."""
    if filename.startswith('dump') or filename.endswith('.json'):
        return 'dump'
    if filename.startswith('log'):
        return 'log'

    # Try to detect by content
    stripped = content.strip()
    if stripped.startswith('{') or stripped.startswith('['):
        try:
            json.loads(stripped)
            return 'dump'
        except:
            pass

    return 'log'


def get_output_path(input_path: Path) -> Path:
    """Generate output path with _trimmed suffix."""
    return input_path.parent / f"{input_path.stem}_trimmed{input_path.suffix}"


def process_file(input_path: Path, output_path: Optional[Path] = None, aggressive: bool = False) -> tuple[int, int]:
    """
    Process a single file.

    Returns (original_size, trimmed_size) in bytes.
    """
    content = input_path.read_text(encoding='utf-8')

    file_type = detect_file_type(content, input_path.name)

    if file_type == 'log':
        trimmed = trim_log_file(content, aggressive=aggressive)
    else:
        trimmed = trim_dump_file(content, aggressive=aggressive)

    if output_path is None:
        output_path = get_output_path(input_path)

    output_path.write_text(trimmed, encoding='utf-8')

    return len(content), len(trimmed)


def process_all_in_tmp(aggressive: bool = False, stats_only: bool = False):
    """Process all log*.md and dump*.md files in tmp/ directory."""
    tmp_dir = Path(__file__).parent.parent / 'tmp'

    if not tmp_dir.exists():
        print(f"Error: {tmp_dir} does not exist")
        return

    files = list(tmp_dir.glob('log*.md')) + list(tmp_dir.glob('dump*.md'))

    # Filter out already trimmed files
    files = [f for f in files if '_trimmed' not in f.name]

    if not files:
        print("No log/dump files found in tmp/")
        return

    print(f"Processing {len(files)} files{' (aggressive)' if aggressive else ''}...\n")

    total_original = 0
    total_trimmed = 0

    for file_path in sorted(files):
        original, trimmed = process_file(file_path, aggressive=aggressive)
        total_original += original
        total_trimmed += trimmed

        reduction = (1 - trimmed / original) * 100 if original > 0 else 0
        output_path = get_output_path(file_path)
        print(f"  {file_path.name}: {original:,} → {trimmed:,} bytes ({reduction:.1f}% reduction)")
        if not stats_only:
            print(f"    → {output_path.name}")

    total_reduction = (1 - total_trimmed / total_original) * 100 if total_original > 0 else 0
    print(f"\nTotal: {total_original:,} → {total_trimmed:,} bytes ({total_reduction:.1f}% reduction)")

    return total_original, total_trimmed


def main():
    args = sys.argv[1:]

    # Parse flags
    aggressive = '--aggressive' in args or '-a' in args
    stats_only = '--stats' in args or '-s' in args
    help_requested = '--help' in args or '-h' in args or '-?' in args

    # Remove flags from args
    args = [a for a in args if not a.startswith('-')]

    if help_requested:
        print(__doc__)
        return

    # Default: process all files in tmp/ if no specific files given
    if not args:
        process_all_in_tmp(aggressive=aggressive, stats_only=stats_only)
        return

    # Process specified files
    for arg in args:
        path = Path(arg)

        if not path.exists():
            print(f"Error: {path} does not exist")
            continue

        if path.is_dir():
            print(f"Skipping directory: {path}")
            continue

        original, trimmed = process_file(path, aggressive=aggressive)
        reduction = (1 - trimmed / original) * 100 if original > 0 else 0
        output_path = get_output_path(path)

        print(f"{path.name}: {original:,} → {trimmed:,} bytes ({reduction:.1f}% reduction)")
        print(f"  → {output_path.name}")


if __name__ == '__main__':
    main()