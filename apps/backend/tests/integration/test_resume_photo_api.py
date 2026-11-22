"""End-to-end profile-photo API validation with isolated SQLite; no user data."""

from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.database import Database
from app.main import app
from app.routers import resumes


@pytest.mark.asyncio
async def test_photo_upload_edit_fetch_delete(tmp_path, monkeypatch):
    db = Database(db_path=tmp_path / "api-photo.db")
    monkeypatch.setattr(resumes, "db", db)
    try:
        created = await db.create_resume(
            content="Example",
            processed_data={"personalInfo": {"name": "Example"}, "summary": "test"},
            processing_status="ready",
        )
        resume_id = created["resume_id"]
        image = BytesIO()
        Image.new("RGB", (64, 80), "navy").save(image, format="PNG")
        url = f"/api/v1/resumes/{resume_id}/photo"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            uploaded = await client.put(
                url,
                files={"file": ("portrait.png", image.getvalue(), "image/png")},
                data={"crop_x": "0", "crop_y": "0", "crop_width": "100", "crop_height": "100", "size": "88"},
            )
            assert uploaded.status_code == 200, uploaded.text
            photo = uploaded.json()["data"]["processed_resume"]["personalInfo"]["photo"]
            assert photo["version"] == 1
            rendered = await client.get(url)
            assert rendered.status_code == 200
            assert rendered.headers["content-type"] == "image/webp"
            assert len(rendered.content) > 10

            edited = await client.patch(
                url,
                json={"cropX": 10, "cropY": 10, "cropWidth": 80, "cropHeight": 80, "size": 92},
            )
            assert edited.status_code == 200, edited.text
            assert edited.json()["data"]["processed_resume"]["personalInfo"]["photo"]["version"] == 2

            deleted = await client.delete(url)
            assert deleted.status_code == 200, deleted.text
            assert deleted.json()["data"]["processed_resume"]["personalInfo"].get("photo") is None
            assert (await client.get(url)).status_code == 404
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_photo_upload_rejects_mismatched_mime(tmp_path, monkeypatch):
    db = Database(db_path=tmp_path / "api-photo-invalid.db")
    monkeypatch.setattr(resumes, "db", db)
    try:
        created = await db.create_resume(content="Example", processed_data={"personalInfo": {}})
        url = f"/api/v1/resumes/{created['resume_id']}/photo"
        image = BytesIO()
        Image.new("RGB", (64, 80), "navy").save(image, format="PNG")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            invalid = await client.put(
                url,
                files={"file": ("portrait.jpg", image.getvalue(), "image/jpeg")},
                data={"crop_x": "0", "crop_y": "0", "crop_width": "100", "crop_height": "100", "size": "88"},
            )
            assert invalid.status_code == 422
            assert await db.get_resume_photo(created["resume_id"]) is None
    finally:
        await db.close()
