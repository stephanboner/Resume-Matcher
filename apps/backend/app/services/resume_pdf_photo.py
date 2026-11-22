"""Place the first-page CV portrait in PDF *page* coordinates, not HTML margins.

Chromium sometimes shrink-to-fits the entire print document when an absolutely
positioned image extends outside its printable content area. Draw the photo
*after* Chromium renders the text to preserve ATS-readable text, pagination,
font size and exactly the same body positions as a resume without a photo.

Dependencies are already part of the backend: Pillow, pypdf, pdfminer.six.
"""

from __future__ import annotations

import io
import math
from collections.abc import Iterator
from typing import Any

from pdfminer.high_level import extract_pages
from pdfminer.layout import LTChar, LTTextLine
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader, PdfWriter, Transformation

PAPER_INSET_MM = 4
PHOTO_TEXT_GAP_PT = 2.25  # 3 CSS px at 96dpi, intentionally close to the text.
MIN_VISIBLE_SIZE_PX = 48
MAX_VISIBLE_SIZE_PX = 144
PX_TO_PT = 72 / 96
MM_TO_PT = 72 / 25.4


def _text_boxes(layout_item: Any) -> Iterator[tuple[float, float, float, float]]:
    """Character boxes catch wrapped contact details and all body text."""
    if isinstance(layout_item, LTChar):
        if layout_item.get_text().strip():
            yield tuple(float(value) for value in layout_item.bbox)
        return
    for child in getattr(layout_item, "_objs", ()):
        yield from _text_boxes(child)


def _first_section_top_pt(layout: Any) -> float | None:
    """Locate the first uppercase section heading after the contact header.

    Mirrors Modern Deedy's section boundaries so the PDF and preview keep the
    portrait above headings, not merely above body text. Unrecognized layouts
    still have per-glyph collision protection.
    """
    lines: list[tuple[float, float, str]] = []

    def visit(item: Any) -> None:
        if isinstance(item, LTTextLine):
            text = item.get_text().strip()
            if text:
                lines.append((float(layout.height - item.bbox[3]), float(item.bbox[0]), text))
            return
        for child in getattr(item, "_objs", ()):
            visit(child)

    visit(layout)
    if not lines:
        return None
    lines.sort(key=lambda entry: entry[0])
    contact_index = next(
        (i for i, (_, _, text) in enumerate(lines)
         if "@" in text or "linkedin" in text.lower() or " | " in text),
        0,
    )

    for top, left, text in lines[contact_index + 1:]:
        letters = [char for char in text if char.isalpha()]
        if (
            top < layout.height * 0.45
            and left < layout.width * 0.5
            and 4 <= len(letters) <= 44
            and all(char.isupper() for char in letters)
        ):
            return top
    return None


def choose_safe_photo_size_px(
    requested_size_px: int,
    page_width_pt: float,
    page_height_pt: float,
    text_boxes: list[tuple[float, float, float, float]],
    *,
    inset_mm: float = PAPER_INSET_MM,
    gap_pt: float = PHOTO_TEXT_GAP_PT,
    first_section_top_pt: float | None = None,
) -> int:
    """Find the largest square at the top right that does not overlap any glyph.

    Text in the left-hand SUMMARY heading may extend vertically beside the
    image. That is fine: only actual glyph intersections constrain the photo.
    """
    if not math.isfinite(float(requested_size_px)):
        return 0
    inset = inset_mm * MM_TO_PT
    right = page_width_pt - inset
    top = page_height_pt - inset
    max_side = min(int(requested_size_px), MAX_VISIBLE_SIZE_PX)
    if first_section_top_pt is not None and math.isfinite(first_section_top_pt):
        # The heading starts a full-width new section, even if its letters are
        # only on the left. Keep the portrait just above that horizontal line.
        max_from_section = math.floor((first_section_top_pt - (page_height_pt - top) - gap_pt) / PX_TO_PT)
        max_side = min(max_side, max_from_section)
    for size in range(max_side, MIN_VISIBLE_SIZE_PX - 1, -1):
        side = size * PX_TO_PT
        left = right - side
        bottom = top - side
        overlap = any(
            x0 < right + gap_pt
            and x1 > left - gap_pt
            and y0 < top + gap_pt
            and y1 > bottom - gap_pt
            for x0, y0, x1, y1 in text_boxes
        )
        if not overlap:
            return size
    return 0


def add_resume_photo_to_pdf(
    pdf_bytes: bytes,
    photo_webp: bytes,
    requested_size_px: int,
) -> bytes:
    """Merge one square photo onto page 1. Never rasterize the CV text."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if not reader.pages:
        return pdf_bytes

    first = reader.pages[0]
    width = float(first.mediabox.width)
    height = float(first.mediabox.height)
    layout = next(iter(extract_pages(io.BytesIO(pdf_bytes), page_numbers=[0])), None)
    if layout is None:
        return pdf_bytes
    text_boxes = list(_text_boxes(layout))
    safe_px = choose_safe_photo_size_px(
        requested_size_px,
        width,
        height,
        text_boxes,
        first_section_top_pt=_first_section_top_pt(layout),
    )
    if not safe_px:
        # No usable space: protecting the text takes precedence over the photo.
        return pdf_bytes

    try:
        with Image.open(io.BytesIO(photo_webp)) as image:
            # Older saved crops can be portrait-oriented; the PDF photo is always square.
            rgb = ImageOps.fit(
                image.convert("RGB"),
                (max(image.size), max(image.size)),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.4),
            )
    except (UnidentifiedImageError, OSError, ValueError):
        return pdf_bytes

    image_pdf = io.BytesIO()
    rgb.save(image_pdf, format="PDF", resolution=72.0)
    image_pdf.seek(0)
    image_page = PdfReader(image_pdf).pages[0]
    target_side = safe_px * PX_TO_PT
    source_width = float(image_page.mediabox.width)
    source_height = float(image_page.mediabox.height)
    inset = PAPER_INSET_MM * MM_TO_PT
    x = width - inset - target_side
    y = height - inset - target_side

    # pypdf's transform is in physical PDF points (origin bottom left), so it
    # cannot trigger Chromium's print shrink-to-fit behaviour.
    first.merge_transformed_page(
        image_page,
        Transformation()
        .scale(target_side / source_width, target_side / source_height)
        .translate(x, y),
        over=True,
        expand=False,
    )
    writer = PdfWriter()
    writer.append(reader)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
