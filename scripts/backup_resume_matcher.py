#!/usr/bin/env python3
"""Create a consistent local SQLite + data-directory backup for Resume Matcher.

Works with a running backend. Backups are not encrypted. Store them only in a
protected directory and use encrypted Time Machine/Restic for offsite copies.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import tarfile
import tempfile


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=root / "apps" / "backend" / "data",
        help="Actual Resume Matcher DATA_DIR (default: apps/backend/data)",
    )
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=Path.home() / "Backups" / "ResumeMatcher",
        help="Directory for local .tar.gz backup archives",
    )
    parser.add_argument(
        "--include-env",
        action="store_true",
        help="Also include apps/backend/.env (may contain plaintext credentials)",
    )
    args = parser.parse_args()

    data_dir = args.data_dir.expanduser().resolve()
    backup_dir = args.backup_dir.expanduser().resolve()
    backend_env = root / "apps" / "backend" / ".env"

    if not data_dir.is_dir():
        parser.error(f"Data directory does not exist: {data_dir}")
    if backup_dir == data_dir or data_dir in backup_dir.parents:
        parser.error("Backup directory must be outside the data directory")
    if (data_dir / "resume_matcher.db").exists() is False and (data_dir / "database.json").exists() is False:
        print("WARNING: Neither SQLite DB nor legacy database.json found. Check --data-dir.", file=sys.stderr)
        return 2

    os.umask(0o077)
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    final_path = backup_dir / f"resume-matcher-{stamp}.tar.gz"

    with tempfile.TemporaryDirectory(prefix="resume-matcher-snapshot-") as tmp:
        stage_root = Path(tmp)
        stage_data = stage_root / "data"

        def ignore_sqlite_files(parent: str, names: list[str]) -> list[str]:
            if Path(parent).resolve() != data_dir:
                return []
            return [n for n in names if n in {"resume_matcher.db", "resume_matcher.db-wal", "resume_matcher.db-shm"}]

        shutil.copytree(data_dir, stage_data, symlinks=True, ignore=ignore_sqlite_files)
        db_source = data_dir / "resume_matcher.db"
        if db_source.is_file():
            db_target = stage_data / "resume_matcher.db"
            with sqlite3.connect(str(db_source), timeout=30) as source:
                with sqlite3.connect(str(db_target), timeout=30) as target:
                    source.backup(target)
                    check = target.execute("PRAGMA quick_check").fetchone()
                    if check != ("ok",):
                        raise RuntimeError(f"SQLite snapshot quick_check failed: {check}")

        manifest = {
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "data_dir": str(data_dir),
            "sqlite_consistent_snapshot": db_source.is_file(),
            "contains_backend_env": bool(args.include_env and backend_env.is_file()),
        }
        (stage_root / "backup-info.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        if args.include_env:
            if backend_env.is_file():
                shutil.copy2(backend_env, stage_root / "backend.env")
            else:
                print(f"WARNING: --include-env requested but {backend_env} does not exist", file=sys.stderr)

        # Create atomically to avoid half-written archives on crash.
        fd, tempname = tempfile.mkstemp(prefix=".resume-matcher-", suffix=".tmp", dir=str(backup_dir))
        os.close(fd)
        temp_path = Path(tempname)
        try:
            with tarfile.open(temp_path, mode="w:gz") as archive:
                archive.add(stage_data, arcname="data")
                archive.add(stage_root / "backup-info.json", arcname="backup-info.json")
                if args.include_env and (stage_root / "backend.env").is_file():
                    archive.add(stage_root / "backend.env", arcname="backend.env")
            with tarfile.open(temp_path, mode="r:gz") as verify:
                names = set(verify.getnames())
                if "data" not in names or "backup-info.json" not in names:
                    raise RuntimeError("Archive validation failed")
                if db_source.is_file() and "data/resume_matcher.db" not in names:
                    raise RuntimeError("Snapshot database missing from archive")
            os.chmod(temp_path, 0o600)
            os.replace(temp_path, final_path)
        finally:
            temp_path.unlink(missing_ok=True)

    print(f"Backup created: {final_path} ({final_path.stat().st_size:,} bytes)")
    print("IMPORTANT: This archive is not encrypted. Copy it to encrypted storage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
