"""Chromium print-geometry regression for the Modern Deedy profile photo.

Unlike style-only tests this checks the actual PDF image position relative to
the physical A4 page. No resume data, external server or frontend is needed.
"""

from __future__ import annotations

import base64
import io

import pytest
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTFigure, LTImage
from PIL import Image
from playwright.async_api import async_playwright

from app.pdf import _launch_browser
from app.services.pdf_photo_layout import PRINT_PHOTO_LAYOUT_JS


def _images(box):
    if isinstance(box, LTImage):
        yield box.bbox
    for item in getattr(box, "_objs", []):
        yield from _images(item)


async def test_photo_printed_near_physical_a4_corner_without_moving_summary():
    photo = Image.new("RGB", (160, 160), "navy")
    memory = io.BytesIO()
    photo.save(memory, format="PNG")
    encoded = base64.b64encode(memory.getvalue()).decode("ascii")
    html = f"""<!doctype html>
    <html><head><style>
      * {{ box-sizing: border-box; }}
      html, body {{ margin: 0; padding: 0; font: 14px Arial; }}
      .resume-print {{ width: 190mm; }}
      [data-photo-overlay] {{ position: relative; }}
      .resume-profile-photo {{
        position: absolute; top: 0; right: 0; width: 120px; height: 120px;
      }}
      .resume-profile-photo img {{ width: 100%; height: 100%; display: block; }}
      header {{ height: 84px; }}
      section {{ margin-top: 3px; }}
    </style></head><body>
      <div class="resume-print"><div data-photo-overlay
        data-photo-template="modern-deedy" data-photo-requested-size="120">
        <div class="resume-template-modern-deedy">
          <header><h1>Example Person</h1><p>email | phone | linkedin</p></header>
          <section data-resume-section="true"><h2>SUMMARY</h2><p>Full text</p></section>
        </div>
        <div class="resume-profile-photo">
          <img src="data:image/png;base64,{encoded}" />
        </div>
      </div></div>
    </body></html>"""

    playwright = await async_playwright().start()
    try:
        try:
            browser = await _launch_browser(playwright)
        except NotImplementedError:
            pytest.skip("Chromium subprocesses unavailable")
        except Exception as error:
            if "executable" in str(error).lower() or "installation was found" in str(error):
                pytest.skip(f"Chromium unavailable: {error}")
            raise
        try:
            page = await browser.new_page()
            await page.emulate_media(media="print")
            await page.set_content(html, wait_until="load")
            before = await page.locator("[data-resume-section]").bounding_box()
            result = await page.evaluate(
                PRINT_PHOTO_LAYOUT_JS, {"topMargin": "10mm", "rightMargin": "10mm"}
            )
            assert result is not None
            assert result["printMedia"] is True
            assert 0 < result["size"] <= 120
            after = await page.locator("[data-resume-section]").bounding_box()
            assert before is not None and after is not None
            assert abs(after["y"] - before["y"]) < 0.1
            assert abs(after["x"] - before["x"]) < 0.1

            photo_bounds = await page.locator(".resume-profile-photo").bounding_box()
            assert photo_bounds is not None
            assert photo_bounds["y"] + photo_bounds["height"] <= after["y"] - 2

            pdf = await page.pdf(
                format="A4", print_background=True,
                margin={"top": "10mm", "right": "10mm", "bottom": "10mm", "left": "10mm"},
            )
            first_page = next(iter(extract_pages(io.BytesIO(pdf))))
            pictures = list(_images(first_page))
            assert pictures, "Printed PDF lost the embedded portrait"
            left, bottom, right, top = pictures[0]
            top_inset_pt = first_page.height - top
            right_inset_pt = first_page.width - right
            four_mm_pt = 4 * 72 / 25.4
            assert abs(top_inset_pt - four_mm_pt) < 2, (top_inset_pt, pictures)
            assert abs(right_inset_pt - four_mm_pt) < 2, (right_inset_pt, pictures)
        finally:
            await browser.close()
    finally:
        await playwright.stop()
