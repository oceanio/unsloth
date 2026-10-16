// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import { readSrc } from "./helpers/kit.ts";

const section = readSrc("features/settings/components/model-aliases-section.tsx");

test("alias suggestions offer enabled connections' checked models by their picker id", () => {
  assert.match(section, /\.filter\(\(provider\) => provider\.is_enabled\)/);
  assert.match(
    section,
    /\(provider\.models \?\? \[\]\)\.map\(\(model\) => \(\{\s*id: buildExternalModelId\(provider\.id, model\),\s*label: `\$\{provider\.display_name\} · \$\{model\}`,/,
  );
  assert.match(section, /<option key=\{id\} value=\{id\} label=\{label\} \/>/);
});
