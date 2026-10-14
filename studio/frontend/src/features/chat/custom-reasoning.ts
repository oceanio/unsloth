// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

/** Explicit connection contract, never inferred from a URL or a model name. */
export const CUSTOM_REASONING_STYLES = [
  "reasoning_effort",
  "reasoning",
  "thinking",
  "chat_template_kwargs.enable_thinking",
] as const;

/** Weakest -> strongest rungs a Custom endpoint may opt into; "none" is the Off row, always offered.
 *  Must stay in sync with CUSTOM_REASONING_EFFORT_LEVELS in backend models/providers.py. */
export const CUSTOM_REASONING_EFFORT_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export const DEFAULT_CUSTOM_REASONING_EFFORT_LEVELS: readonly CustomReasoningEffortLevel[] =
  ["low", "medium", "high"];

export type CustomReasoningStyle = (typeof CUSTOM_REASONING_STYLES)[number];
export type CustomReasoningEffortLevel =
  (typeof CUSTOM_REASONING_EFFORT_LEVELS)[number];
export type CustomReasoningConfig = {
  enabled: boolean;
  style: CustomReasoningStyle;
  /** Absent means DEFAULT_CUSTOM_REASONING_EFFORT_LEVELS. Only effort styles carry a ladder. */
  effort_levels?: CustomReasoningEffortLevel[];
};

/** Styles whose wire format carries an effort level rather than just on/off. */
export function customReasoningStyleTakesEffort(
  style: CustomReasoningStyle,
): boolean {
  return style === "reasoning_effort" || style === "reasoning";
}

export function customReasoningEffortLevels(
  config: CustomReasoningConfig | undefined,
): readonly CustomReasoningEffortLevel[] {
  return config?.effort_levels ?? DEFAULT_CUSTOM_REASONING_EFFORT_LEVELS;
}

/** The connection form's draft as saved: an unchecked-to-default or non-effort ladder is dropped. */
export function customReasoningConfigForSave(
  config: CustomReasoningConfig | null,
): CustomReasoningConfig | null {
  if (!config) return null;
  const { effort_levels: levels, ...rest } = config;
  if (
    !levels ||
    levels.length === 0 ||
    !customReasoningStyleTakesEffort(config.style) ||
    (levels.length === DEFAULT_CUSTOM_REASONING_EFFORT_LEVELS.length &&
      DEFAULT_CUSTOM_REASONING_EFFORT_LEVELS.every((level) => levels.includes(level)))
  ) {
    return rest;
  }
  return { ...rest, effort_levels: canonicalEffortLevels(levels) };
}

function canonicalEffortLevels(
  levels: readonly unknown[],
): CustomReasoningEffortLevel[] {
  return CUSTOM_REASONING_EFFORT_LEVELS.filter((level) => levels.includes(level));
}

/** Cached or legacy malformed contracts fail closed. */
export function normalizeCustomReasoningConfig(
  value: unknown,
): CustomReasoningConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const config = value as Record<string, unknown>;
  if (
    Object.keys(config).some(
      (key) => key !== "enabled" && key !== "style" && key !== "effort_levels",
    ) ||
    typeof config.enabled !== "boolean" ||
    !CUSTOM_REASONING_STYLES.includes(config.style as CustomReasoningStyle)
  ) {
    return undefined;
  }
  const style = config.style as CustomReasoningStyle;
  const rawLevels = config.effort_levels;
  if (rawLevels == null) return { enabled: config.enabled, style };
  if (
    !Array.isArray(rawLevels) ||
    rawLevels.length === 0 ||
    !customReasoningStyleTakesEffort(style) ||
    rawLevels.some(
      (level) =>
        !CUSTOM_REASONING_EFFORT_LEVELS.includes(level as CustomReasoningEffortLevel),
    )
  ) {
    return undefined;
  }
  return {
    enabled: config.enabled,
    style,
    effort_levels: canonicalEffortLevels(rawLevels),
  };
}

/** Medium when the ladder offers it, else the nearest rung below, else the weakest. Matches the backend. */
function defaultCustomReasoningEffort(
  levels: readonly CustomReasoningEffortLevel[],
): CustomReasoningEffortLevel {
  if (levels.includes("medium")) return "medium";
  const rank = CUSTOM_REASONING_EFFORT_LEVELS.indexOf("medium");
  const below = levels.filter(
    (level) => CUSTOM_REASONING_EFFORT_LEVELS.indexOf(level) < rank,
  );
  return below[below.length - 1] ?? levels[0] ?? "medium";
}

/** Studio's generic controls; the backend alone translates them to the selected wire style. */
export function customReasoningRequestFields(
  value: unknown,
  enabled: boolean,
  effort: string,
): {
  reasoning_effort?: "none" | CustomReasoningEffortLevel;
  thinking?: { type: "enabled" | "disabled" };
} {
  const config = normalizeCustomReasoningConfig(value);
  if (!config?.enabled) return {};
  if (customReasoningStyleTakesEffort(config.style)) {
    const levels = customReasoningEffortLevels(config);
    const level = levels.includes(effort as CustomReasoningEffortLevel)
      ? (effort as CustomReasoningEffortLevel)
      : defaultCustomReasoningEffort(levels);
    return { reasoning_effort: !enabled || effort === "none" ? "none" : level };
  }
  return { thinking: { type: enabled ? "enabled" : "disabled" } };
}
