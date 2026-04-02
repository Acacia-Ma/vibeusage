import React, { useEffect, useMemo, useState } from "react";
import { Select } from "@base-ui/react/select";

import { copy } from "../../../lib/copy";
import { formatCompactNumber, toDisplayNumber, toFiniteNumber } from "../../../lib/format";
import { fetchGithubRepoMeta } from "../../../lib/github-repo-meta";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";
import { shouldFetchGithubStars } from "../util/should-fetch-github-stars.js";

const LIMIT_OPTIONS = [3, 6, 10];

function splitRepoKey(value) {
  if (typeof value !== "string") return { owner: "", repo: "" };
  const [owner, repo] = value.split("/");
  return { owner: owner || "", repo: repo || "" };
}

function resolveTokens(entry) {
  if (!entry) return null;
  const total = entry.total_tokens ?? null;
  const billable = entry.billable_total_tokens ?? null;
  const billableValue = toFiniteNumber(billable);
  const totalValue = toFiniteNumber(total);
  if (billableValue === 0 && totalValue != null && totalValue > 0) {
    return total;
  }
  return billable ?? total ?? null;
}

function useGithubRepoMeta(repoId) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!repoId) return;

    if (typeof window === "undefined") return;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const screenshotCapture =
      typeof document !== "undefined" &&
      (document.documentElement?.classList.contains("screenshot-capture") ||
        document.body?.classList.contains("screenshot-capture"));
    if (!shouldFetchGithubStars({ prefersReducedMotion, screenshotCapture })) {
      return;
    }

    let active = true;
    fetchGithubRepoMeta(repoId)
      .then((meta) => {
        if (!active) return;
        setState(meta);
      })
      .catch(() => {
        if (!active) return;
        setState({ stars: null, avatarUrl: null });
      });

    return () => {
      active = false;
    };
  }, [repoId]);

  return state;
}

export function ProjectUsagePanel({
  entries = [],
  limit = 3,
  onLimitChange,
  loading = false,
  error = null,
  className = "",
}) {
  const placeholder = copy("shared.placeholder.short");
  const tokensLabel = copy("dashboard.projects.tokens_label");
  const starsLabel = copy("dashboard.projects.stars_label");
  const emptyLabel = copy("dashboard.projects.empty");
  const errorLabel = copy("backend.meta.error_label");
  const limitLabel = copy("dashboard.projects.limit_label");
  const limitAria = copy("dashboard.projects.limit_aria");
  const optionLabels = {
    3: copy("dashboard.projects.limit_top_3"),
    6: copy("dashboard.projects.limit_top_6"),
    10: copy("dashboard.projects.limit_top_10"),
  };
  const resolvedLimit = LIMIT_OPTIONS.includes(limit) ? limit : LIMIT_OPTIONS[0];

  const sortedEntries = useMemo(() => {
    const list = Array.isArray(entries) ? entries.slice() : [];
    return list.sort((a, b) => {
      const aValue = toFiniteNumber(resolveTokens(a)) ?? 0;
      const bValue = toFiniteNumber(resolveTokens(b)) ?? 0;
      return bValue - aValue;
    });
  }, [entries]);

  const displayEntries = sortedEntries.slice(0, Math.max(1, limit));
  const placeholderEntries = Array.from({ length: Math.max(1, resolvedLimit) }, (_, index) => {
    return index;
  });
  let emptyStateContent = emptyLabel;
  if (loading) {
    emptyStateContent = (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {placeholderEntries.map((index) => (
          <ProjectUsagePlaceholderCard
            key={`placeholder-${index}`}
            placeholder={placeholder}
          />
        ))}
      </div>
    );
  } else if (error) {
    emptyStateContent = (
      <>
        <span>{errorLabel}:</span>{" "}
        <span className="normal-case tracking-normal">{error}</span>
      </>
    );
  }

  const tokenFormatOptions = {
    thousandSuffix: copy("shared.unit.thousand_abbrev"),
    millionSuffix: copy("shared.unit.million_abbrev"),
    billionSuffix: copy("shared.unit.billion_abbrev"),
    decimals: 1,
  };

  return (
    <AsciiBox
      title={copy("dashboard.projects.title")}
      subtitle={copy("dashboard.projects.subtitle")}
      className={className}
      bodyClassName="py-4"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span style={{ fontSize: 11, color: "var(--win-text)" }}>
          {limitLabel}
        </span>
        <div className="relative">
          <Select.Root
            value={resolvedLimit}
            items={LIMIT_OPTIONS.map((value) => ({
              value,
              label: optionLabels[value],
            }))}
            onValueChange={(value) => {
              if (typeof onLimitChange === "function" && value != null) {
                onLimitChange(value);
              }
            }}
          >
            <Select.Trigger
              aria-label={limitAria}
              className="win-btn"
              style={{ fontSize: 11, minWidth: 0, padding: "2px 8px", gap: 4 }}
            >
              <Select.Value />
              <span>▾</span>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner align="end" side="bottom" sideOffset={2} className="z-50">
                <Select.Popup
                  style={{
                    background: "var(--win-btn-face)",
                    border: "2px solid var(--win-btn-dark-shadow)",
                    borderTop: "2px solid var(--win-btn-highlight)",
                    borderLeft: "2px solid var(--win-btn-highlight)",
                    minWidth: 120,
                    boxShadow: "2px 2px 4px var(--win-overlay-shadow)",
                  }}
                >
                  <Select.List aria-label={limitAria} role="listbox">
                    {LIMIT_OPTIONS.map((value) => (
                      <Select.Item
                        key={value}
                        value={value}
                        className={({ selected }) =>
                          `w-full text-left px-2 py-1 ${
                            selected
                              ? "bg-win-highlight text-white"
                              : "hover:bg-win-highlight hover:text-white"
                          }`
                        }
                        style={{ fontSize: 11, fontFamily: '"Tahoma", sans-serif', cursor: "default" }}
                      >
                        <Select.ItemText>{optionLabels[value]}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      {displayEntries.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--win-dark)" }}>
          {emptyStateContent}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayEntries.map((entry) => (
            <ProjectUsageCard
              key={`${entry?.project_key || "repo"}-${entry?.project_ref || ""}`}
              entry={entry}
              placeholder={placeholder}
              tokensLabel={tokensLabel}
              starsLabel={starsLabel}
              tokenFormatOptions={tokenFormatOptions}
            />
          ))}
        </div>
      )}
    </AsciiBox>
  );
}

function ProjectUsageCard({
  entry,
  placeholder,
  tokensLabel,
  starsLabel,
  tokenFormatOptions,
}) {
  const repoKey = typeof entry?.project_key === "string" ? entry.project_key : "";
  const projectRef = typeof entry?.project_ref === "string" ? entry.project_ref : "";
  const { owner, repo } = splitRepoKey(
    repoKey || projectRef.replace("https://github.com/", "")
  );
  const repoId = owner && repo ? `${owner}/${repo}` : repoKey;
  const meta = useGithubRepoMeta(repoId);
  const avatarUrl =
    meta?.avatarUrl || (owner ? `https://github.com/${owner}.png?size=80` : "");
  const starsRaw = meta?.stars;
  const starsFull =
    starsRaw == null ? placeholder : toDisplayNumber(starsRaw);
  const starsCompact =
    starsRaw == null
      ? placeholder
      : formatCompactNumber(starsRaw, tokenFormatOptions);
  const tokensRaw = resolveTokens(entry);
  const tokensFull =
    tokensRaw == null ? placeholder : toDisplayNumber(tokensRaw);
  const tokensCompact =
    tokensRaw == null
      ? placeholder
      : formatCompactNumber(tokensRaw, tokenFormatOptions);

  return (
    <a
      href={projectRef || (repoId ? `https://github.com/${repoId}` : "#")}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col gap-2 min-h-[120px]"
      data-project-card="true"
      style={{
        background: "var(--win-sunken)",
        borderTop: "1px solid var(--win-btn-dark-shadow)",
        borderLeft: "1px solid var(--win-btn-dark-shadow)",
        borderBottom: "1px solid var(--win-btn-highlight)",
        borderRight: "1px solid var(--win-btn-highlight)",
        padding: "8px 10px",
        textDecoration: "none",
        color: "var(--win-text)",
      }}
    >
      {/* Stars badge */}
      <div
        className="absolute right-2 top-2 flex items-center gap-1"
        data-card-line="stars"
        data-star-slot="corner"
        data-star-position="top-right"
        style={{ fontSize: 10, color: "var(--win-dark)" }}
      >
        <span className="sr-only">{starsLabel}</span>
        <svg
          viewBox="0 0 16 16"
          className="h-[1.3em] w-[1.3em]"
          data-star-icon="true"
          style={{ fill: "var(--win-warning)" }}
          aria-hidden="true"
        >
          <path d="M8 1.1 10.1 5.4l4.8.7-3.5 3.4.8 4.8L8 11.9l-4.2 2.4.8-4.8L1.1 6.1l4.8-.7L8 1.1z" />
        </svg>
        <span title={starsFull}>{starsCompact}</span>
      </div>

      {/* Identity row */}
      <div
        className="flex items-center gap-2 pr-12"
        data-card-line="identity"
        data-owner-row="true"
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "1px solid var(--win-btn-dark-shadow)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={owner || repoKey} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "var(--win-btn-face)" }} />
          )}
        </div>
        <div
          className="max-w-[8rem] truncate"
          style={{ fontSize: 10, color: "var(--win-dark)" }}
          data-card-field="owner"
        >
          {owner || placeholder}
        </div>
      </div>

      {/* Repo name */}
      <div
        className="max-w-full truncate"
        style={{ fontSize: 13, fontWeight: "bold", color: "var(--win-text-accent)" }}
        title={repo || repoKey}
        data-card-line="repo"
        data-card-field="repo"
      >
        {repo || repoKey || placeholder}
      </div>

      {/* Tokens row */}
      <div
        className="flex items-center justify-between gap-2 mt-auto"
        data-card-line="tokens"
        style={{ fontSize: 10, paddingTop: 4, borderTop: "1px solid var(--win-btn-shadow)" }}
      >
        <span style={{ color: "var(--win-dark)" }}>{tokensLabel}</span>
        <span style={{ fontWeight: "bold", color: "var(--win-text-accent)", fontSize: 12 }} title={tokensFull}>
          {tokensCompact}
        </span>
      </div>
    </a>
  );
}

function ProjectUsagePlaceholderCard({ placeholder }) {
  return (
    <div
      className="relative flex flex-col gap-2 min-h-[120px] opacity-50"
      data-project-card-placeholder="true"
      style={{
        background: "var(--win-sunken)",
        borderTop: "1px solid var(--win-btn-dark-shadow)",
        borderLeft: "1px solid var(--win-btn-dark-shadow)",
        borderBottom: "1px solid var(--win-btn-highlight)",
        borderRight: "1px solid var(--win-btn-highlight)",
        padding: "8px 10px",
      }}
    >
      <div className="flex items-start gap-2">
        <div
          style={{
            width: 32,
            height: 32,
            background: "var(--win-btn-face)",
            border: "1px solid var(--win-btn-shadow)",
            flexShrink: 0,
          }}
        />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div style={{ height: 12, width: 80, background: "var(--win-btn-face)", border: "1px solid var(--win-btn-shadow)" }} />
          <div style={{ height: 10, width: 60, background: "var(--win-btn-face)", border: "1px solid var(--win-btn-shadow)" }} />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span style={{ fontSize: 10, color: "var(--win-dark)" }}>{placeholder}</span>
        <span style={{ fontSize: 10, color: "var(--win-dark)" }}>{placeholder}</span>
      </div>
    </div>
  );
}
