"""PDF photo postprocessing preserves PDF text and anchors to physical A4 edges."""

from __future__ import annotations

import io

import pytest
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTImage
from PIL import Image
from pypdf import PdfReader, PdfWriter

from app.services.resume_pdf_photo import (
    add_resume_photo_to_pdf,
    choose_safe_photo_size_px,
)


def _iter_image_boxes(obj):
    if isinstance(obj, LTImage):
        yield obj.bbox
    for child in getattr(obj, "_objs", ()):
        yield from _iter_image_boxes(child)


def _blank_a4() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=595.2756, height=841.8898)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _photo() -> bytes:
    img = Image.new("RGB", (160, 160), "navy")
    out = io.BytesIO()
    img.save(out, format="WEBP")
    return out.getvalue()


def test_square_photo_has_four_mm_physical_page_inset():
    exported = add_resume_photo_to_pdf(_blank_a4(), _photo(), 120)
    page = PdfReader(io.BytesIO(exported)).pages[0]
    assert float(page.mediabox.width) == pytest.approx(595.2756, abs=0.01)
    layout = next(iter(extract_pages(io.BytesIO(exported))))
    boxes = list(_iter_image_boxes(layout))
    assert len(boxes) == 1
    left, bottom, right, top = boxes[0]
    inset_points = 4 * 72 / 25.4
    assert float(page.mediabox.width) - right == pytest.approx(inset_points, abs=0.8)
    assert float(page.mediabox.height) - top == pytest.approx(inset_points, abs=0.8)
    assert right - left == pytest.approx(120 * 72 / 96, abs=0.8)
    assert top - bottom == pytest.approx(right - left, abs=0.8)


def test_long_contact_text_forces_smaller_photo_without_touching_text():
    width, height = 595.2756, 841.8898
    # This block spans the intended photo region on the right, directly below
    # contact details; an intact 120px square would have hidden the letters.
    text = [(515.0, 745.0, 545.0, 760.0)]
    safe = choose_safe_photo_size_px(120, width, height, text)
    assert 48 <= safe < 100
    assert choose_safe_photo_size_px(120, width, height, []) == 120
    # An isolated heading on the left should not unnecessarily shrink the image.
    assert choose_safe_photo_size_px(120, width, height, [(20, 745, 125, 765)]) == 120


def test_unsupported_or_invalid_images_leave_pdf_unchanged():
    original = _blank_a4()
    assert add_resume_photo_to_pdf(original, b"not an image", 120) == original


def test_no_second_page_or_document_scaling():
    writer = PdfWriter()
    writer.add_blank_page(width=595.2756, height=841.8898)
    writer.add_blank_page(width=595.2756, height=841.8898)
    data = io.BytesIO()
    writer.write(data)
    result = add_resume_photo_to_pdf(data.getvalue(), _photo(), 120)
    reader = PdfReader(io.BytesIO(result))
    assert len(reader.pages) == 2
    # The original unmodified second page contains no image resources.
    second_layout = list(extract_pages(io.BytesIO(result), page_numbers=[1]))[0]
    assert list(_iter_image_boxes(second_layout)) == []
