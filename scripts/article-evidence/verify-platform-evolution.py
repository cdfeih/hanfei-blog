"""Run selected committed, offline migration tests without changing SE-MBSE.

Usage: python -B scripts/article-evidence/verify-platform-evolution.py /path/to/SE-MBSE
Requires Python 3.10+. Uses only the standard library; never connects to a database.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile


COMMIT = "4918e0d27813a06f7496bd387758e7f3d474ed20"
FILES = (
    "convert-mysql-migrations-to-dm.py",
    "mysql_migration_model.py",
    "test_convert_mysql_migrations_to_dm.py",
    "test_mysql_migration_model.py",
)
TESTS = [
    "test_mysql_migration_model",
    "test_convert_mysql_migrations_to_dm.StringConversionTest",
    "test_convert_mysql_migrations_to_dm.SelectedMigrationTest."
    "test_cli_only_converts_selected_files_and_reserves_existing_indexes",
]
TESTS += [
    "test_convert_mysql_migrations_to_dm.IdempotentIndexTest." + name
    for name in (
        "test_guards_generated_ddl_only_and_accepts_unquoted_columns",
        "test_guard_matches_complete_ordered_columns_in_current_schema",
        "test_unique_index_guard_does_not_accept_nonunique_index",
        "test_dynamic_index_names_are_reserved",
        "test_expression_indexes_are_not_silently_guarded",
    )
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path)
    args = parser.parse_args()
    hashes = {}
    # Only the new temporary directory is written and automatically cleaned up.
    with tempfile.TemporaryDirectory(prefix="blog-migration-evidence-") as directory:
        for name in FILES:
            source = "scripts/database/" + name
            data = subprocess.check_output(
                ["git", "-C", str(args.repo), "show", f"{COMMIT}:{source}"]
            )
            (Path(directory) / name).write_bytes(data)
            hashes[source] = hashlib.sha256(data).hexdigest()
        result = subprocess.run(
            [sys.executable, "-B", "-m", "unittest", *TESTS, "-v"],
            cwd=directory, capture_output=True, text=True, encoding="utf-8",
        )
    print(result.stdout, end="")
    print(result.stderr, end="")
    print(json.dumps({"commit": COMMIT, "sha256": hashes,
                      "exitCode": result.returncode}, ensure_ascii=False, indent=2))
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
