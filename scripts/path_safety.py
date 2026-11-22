# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

def same_path(first, second):
    """Compare prospective paths and existing file aliases, including hard links."""
    if first.resolve() == second.resolve():
        return True
    try:
        return first.samefile(second)
    except FileNotFoundError:
        return False
