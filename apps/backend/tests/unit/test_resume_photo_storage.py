"""Persistence contract for the optional resume photo using isolated SQLite."""

import pytest

from app.database import Database


@pytest.fixture
async def db(tmp_path):
    database = Database(db_path=tmp_path / "photo-test.db")
    yield database
    await database.close()


SETTINGS = {"cropX": 0, "cropY": 0, "cropWidth": 100, "cropHeight": 100, "size": 88}


async def test_upload_returns_authoritative_metadata_and_preserves_text(db):
    resume = await db.create_resume(
        content="original",
        processed_data={"personalInfo": {"name": "Example Person"}, "summary": "Hello"},
        processing_status="ready",
    )
    resume_id = resume["resume_id"]
    updated = await db.put_resume_photo(
        resume_id,
        source_data=b"original-webp",
        display_data=b"cropped-webp",
        source_width=200,
        source_height=300,
        settings=SETTINGS,
        aspect_ratio=2/3,
    )
    meta = updated["processed_data"]["personalInfo"]["photo"]
    assert meta["version"] == 1
    assert meta["aspectRatio"] == pytest.approx(2/3)
    assert updated["processed_data"]["summary"] == "Hello"
    photo = await db.get_resume_photo(resume_id)
    assert photo["source_data"] == b"original-webp"
    assert photo["display_data"] == b"cropped-webp"


async def test_normal_updates_cannot_replace_or_delete_photo_metadata(db):
    resume = await db.create_resume(content="original", processed_data={"personalInfo": {"name": "A"}})
    resume_id = resume["resume_id"]
    await db.put_resume_photo(
        resume_id, source_data=b"a", display_data=b"b",
        source_width=1, source_height=1, settings=SETTINGS, aspect_ratio=1,
    )
    changed = await db.update_resume(resume_id, {
        "processed_data": {"personalInfo": {"name": "B", "photo": {"version": 999}}, "summary": "New"}
    })
    assert changed["processed_data"]["personalInfo"]["photo"]["version"] == 1
    assert changed["processed_data"]["summary"] == "New"
    changed = await db.update_resume(resume_id, {"processed_data": {"personalInfo": {"name": "C"}}})
    assert changed["processed_data"]["personalInfo"]["photo"]["version"] == 1


async def test_edit_replaces_derivative_but_preserves_source_and_increments_version(db):
    resume = await db.create_resume(content="x", processed_data={"personalInfo": {}})
    resume_id = resume["resume_id"]
    await db.put_resume_photo(
        resume_id, source_data=b"source", display_data=b"first",
        source_width=100, source_height=100, settings=SETTINGS, aspect_ratio=1,
    )
    updated = await db.update_resume_photo(
        resume_id, display_data=b"second", settings={**SETTINGS, "size": 96}, aspect_ratio=1,
    )
    assert updated["processed_data"]["personalInfo"]["photo"]["version"] == 2
    photo = await db.get_resume_photo(resume_id)
    assert photo["source_data"] == b"source"
    assert photo["display_data"] == b"second"


async def test_photo_clone_is_independent(db):
    source = await db.create_resume(content="master", processed_data={"personalInfo": {"name": "A"}})
    target = await db.create_resume(content="copy", processed_data={"personalInfo": {"name": "B"}})
    await db.put_resume_photo(
        source["resume_id"], source_data=b"source", display_data=b"first",
        source_width=100, source_height=100, settings=SETTINGS, aspect_ratio=1,
    )
    await db.clone_resume_photo(source["resume_id"], target["resume_id"])
    cloned = await db.get_resume_photo(target["resume_id"])
    assert cloned["source_data"] == b"source"
    await db.update_resume_photo(
        target["resume_id"], display_data=b"second", settings=SETTINGS, aspect_ratio=1,
    )
    original = await db.get_resume_photo(source["resume_id"])
    assert original["display_data"] == b"first"


async def test_delete_photo_and_resume_cleanup(db):
    resume = await db.create_resume(content="x", processed_data={"personalInfo": {}})
    resume_id = resume["resume_id"]
    await db.put_resume_photo(
        resume_id, source_data=b"source", display_data=b"display",
        source_width=100, source_height=100, settings=SETTINGS, aspect_ratio=1,
    )
    cleared = await db.delete_resume_photo(resume_id)
    assert "photo" not in cleared["processed_data"]["personalInfo"]
    assert await db.get_resume_photo(resume_id) is None
    await db.put_resume_photo(
        resume_id, source_data=b"source", display_data=b"display",
        source_width=100, source_height=100, settings=SETTINGS, aspect_ratio=1,
    )
    assert await db.delete_resume(resume_id) is True
    assert await db.get_resume_photo(resume_id) is None
