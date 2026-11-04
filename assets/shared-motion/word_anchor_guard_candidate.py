# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Validate causal completion, not merely increasing word-anchor order."""
def require_completed(anchors,links,tolerance=1e-9):
    """links = [(earlier_key, fixed_seconds, later_key), ...].
    Durations are chosen by choreography, never derived from narration gaps.
    """
    for before,seconds,after in links:
        if seconds<=0: raise ValueError("duration must be positive")
        if anchors[after]+tolerance < anchors[before]+seconds:
            raise ValueError(f"{before} has not completed before {after}")
    return True
