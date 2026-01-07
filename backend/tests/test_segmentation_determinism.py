"""
Test for segmentation determinism (Phase A, Task A5).

This test ensures that:
1. Same input text produces same segments across multiple runs
2. Segment ordering is stable
3. Segment boundaries (start/end) are consistent
4. No race conditions or non-deterministic behavior
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add src directory to path for imports
BACKEND_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BACKEND_DIR / "src"
sys.path.insert(0, str(SRC_DIR))

import pytest
from ai_organizer.ingest.segmenters import segment_qa, segment_paragraphs


def test_qa_segmentation_determinism():
    """Test that QA segmentation produces identical results across multiple runs."""
    text = """
    Question: What is Python?
    Answer: Python is a programming language.

    Question: What is FastAPI?
    Answer: FastAPI is a web framework.

    Question: What is SQLite?
    Answer: SQLite is a database.
    """

    # Run segmentation multiple times
    result1 = segment_qa(text)
    result2 = segment_qa(text)
    result3 = segment_qa(text)

    # All results should be identical
    assert result1 == result2 == result3, "QA segmentation should be deterministic"

    # Verify structure
    assert len(result1) > 0, "Should produce at least one segment"
    for seg in result1:
        assert "content" in seg, "Segment should have content"
        assert "start" in seg, "Segment should have start"
        assert "end" in seg, "Segment should have end"
        assert isinstance(seg["start"], int), "Start should be integer"
        assert isinstance(seg["end"], int), "End should be integer"
        assert seg["start"] < seg["end"], "Start should be less than end"
        assert seg["start"] >= 0, "Start should be non-negative"
        assert seg["end"] <= len(text), "End should not exceed text length"


def test_paragraph_segmentation_determinism():
    """Test that paragraph segmentation produces identical results across multiple runs."""
    text = """
    This is the first paragraph. It contains multiple sentences.
    This is the second sentence of the first paragraph.

    This is the second paragraph. It also has multiple sentences.
    This is another sentence in the second paragraph.

    This is the third paragraph. It is shorter.
    """

    # Run segmentation multiple times
    result1 = segment_paragraphs(text)
    result2 = segment_paragraphs(text)
    result3 = segment_paragraphs(text)

    # All results should be identical
    assert result1 == result2 == result3, "Paragraph segmentation should be deterministic"

    # Verify structure
    assert len(result1) > 0, "Should produce at least one segment"
    for seg in result1:
        assert "content" in seg, "Segment should have content"
        assert "start" in seg, "Segment should have start"
        assert "end" in seg, "Segment should have end"
        assert isinstance(seg["start"], int), "Start should be integer"
        assert isinstance(seg["end"], int), "End should be integer"
        assert seg["start"] < seg["end"], "Start should be less than end"
        assert seg["start"] >= 0, "Start should be non-negative"
        assert seg["end"] <= len(text), "End should not exceed text length"


def test_segmentation_ordering_stability():
    """Test that segment ordering is stable across runs."""
    text = """
    Question 1: What is A?
    Answer: A is the first letter.

    Question 2: What is B?
    Answer: B is the second letter.

    Question 3: What is C?
    Answer: C is the third letter.
    """

    result1 = segment_qa(text)
    result2 = segment_qa(text)

    # Ordering should be stable
    assert len(result1) == len(result2), "Should produce same number of segments"
    
    for i, (seg1, seg2) in enumerate(zip(result1, result2)):
        assert seg1["start"] == seg2["start"], f"Segment {i} start should match"
        assert seg1["end"] == seg2["end"], f"Segment {i} end should match"
        assert seg1["content"] == seg2["content"], f"Segment {i} content should match"


def test_segmentation_boundaries_consistency():
    """Test that segment boundaries are consistent and non-overlapping."""
    text = """
    This is a test document with multiple paragraphs.
    Each paragraph should be segmented separately.

    This is another paragraph that should be segmented.
    """

    result = segment_paragraphs(text)

    # Verify boundaries are consistent
    for i, seg in enumerate(result):
        start = seg["start"]
        end = seg["end"]
        
        # Boundaries should be valid
        assert start >= 0, f"Segment {i} start should be non-negative"
        assert end <= len(text), f"Segment {i} end should not exceed text length"
        assert start < end, f"Segment {i} start should be less than end"
        
        # Content should match text slice
        expected_content = text[start:end].strip()
        actual_content = seg["content"].strip()
        assert actual_content == expected_content, f"Segment {i} content should match text slice"

    # Verify segments don't overlap (except at boundaries)
    for i in range(len(result) - 1):
        current_end = result[i]["end"]
        next_start = result[i + 1]["start"]
        # Segments can be adjacent but not overlapping
        assert next_start >= current_end, f"Segment {i+1} should not overlap with segment {i}"


def test_empty_text_handling():
    """Test that empty text is handled gracefully."""
    empty_text = ""
    
    result_qa = segment_qa(empty_text)
    result_para = segment_paragraphs(empty_text)
    
    # Empty text should produce empty segments or handle gracefully
    assert isinstance(result_qa, list), "Should return a list"
    assert isinstance(result_para, list), "Should return a list"
    
    # Empty text might produce 0 segments or handle it gracefully
    # (Implementation dependent, but should not crash)


def test_whitespace_handling():
    """Test that whitespace-only text is handled correctly."""
    whitespace_text = "   \n\n   \t   "
    
    result_qa = segment_qa(whitespace_text)
    result_para = segment_paragraphs(whitespace_text)
    
    # Should handle whitespace gracefully
    assert isinstance(result_qa, list), "Should return a list"
    assert isinstance(result_para, list), "Should return a list"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

