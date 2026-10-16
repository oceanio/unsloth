# SPDX-License-Identifier: AGPL-3.0-only
# Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

"""Model aliases whose target is a Connection model (``external::<connection id>::<model>``)."""

import asyncio

import pytest

from utils.model_aliases import set_model_aliases

TARGET = "external::conn1::ARC4NUM%2FQwen-4bit"


@pytest.fixture
def store(monkeypatch):
    import storage.studio_db as db
    import utils.openai_auto_switch_settings as settings

    data: dict = {}
    monkeypatch.setattr(db, "upsert_app_settings", lambda mapping: data.update(mapping))
    monkeypatch.setattr(settings, "_cached_setting", lambda k, d = None: data.get(k, d))
    return data


@pytest.fixture
def provider():
    return {
        "id": "conn1",
        "provider_type": "custom",
        "is_enabled": 1,
        "models": ["ARC4NUM/Qwen-4bit"],
    }


@pytest.fixture
def inference(monkeypatch, provider):
    import routes.inference as inference
    import storage.providers_db as providers_db

    async def catalog(quant_pins = False):
        return [{"id": "unsloth/Qwen3-4B-GGUF", "object": "model", "loaded": False}]

    monkeypatch.setattr(inference, "_openai_catalog_objects", catalog)
    monkeypatch.setattr(inference, "_openai_model_objects", lambda: [])
    monkeypatch.setattr(
        providers_db, "get_provider", lambda pid: dict(provider) if pid == "conn1" else None
    )
    return inference


def test_list_and_retrieve_an_alias_to_a_connection_model(store, inference):
    set_model_aliases([{"name": "qwen-remote", "model": TARGET}])
    listed = asyncio.run(inference.openai_list_models(current_subject = "owner"))["data"]
    assert [(m["id"], m.get("alias_for")) for m in listed] == [
        ("unsloth/Qwen3-4B-GGUF", None),
        ("qwen-remote", TARGET),
    ]
    assert listed[1]["owned_by"] == "custom"
    got = asyncio.run(inference.openai_retrieve_model("qwen-remote", current_subject = "owner"))
    assert got["alias_for"] == TARGET


@pytest.mark.parametrize(
    "target, change",
    [
        (TARGET, {"is_enabled": 0}),
        (TARGET, {"models": ["something-else"]}),
        ("external::missing::ARC4NUM%2FQwen-4bit", {}),
    ],
)
def test_an_alias_to_an_unservable_connection_model_is_not_listed(
    store, inference, provider, target, change
):
    provider.update(change)
    set_model_aliases([{"name": "qwen-remote", "model": target}])
    listed = asyncio.run(inference.openai_list_models(current_subject = "owner"))["data"]
    assert [m["id"] for m in listed] == ["unsloth/Qwen3-4B-GGUF"]
