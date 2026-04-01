import { Button } from "@base-ui/react/button";
import React, { useEffect, useState } from "react";
import { copy } from "../../../lib/copy";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";

function normalizeBadgePart(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toTitleWords(value) {
  const normalized = normalizeBadgePart(value);
  if (!normalized) return "";
  return normalized
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((token) => token.slice(0, 1).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function buildSubscriptionItems(subscriptions) {
  if (!Array.isArray(subscriptions)) return [];
  const deduped = new Map();
  for (const entry of subscriptions) {
    if (!entry || typeof entry !== "object") continue;
    const toolRaw = normalizeBadgePart(entry.tool);
    const planRaw = normalizeBadgePart(entry.planType) || normalizeBadgePart(entry.plan_type);
    if (!toolRaw || !planRaw) continue;
    const tool = toTitleWords(toolRaw) || toolRaw;
    const plan = toTitleWords(planRaw) || planRaw;
    deduped.set(`${toolRaw.toLowerCase()}::${planRaw.toLowerCase()}`, { tool, plan });
  }
  return Array.from(deduped.values());
}

// Win2K avatar — pixel-art style square
function Win2KAvatar({ name, size = 56 }) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "var(--win-titlebar)",
        border: "2px solid var(--win-btn-dark-shadow)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: '"Tahoma", sans-serif',
        fontWeight: "bold",
        fontSize: Math.round(size * 0.36),
        color: "#ffffff",
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

export function IdentityCard({
  name = copy("identity_card.name_default"),
  avatarUrl,
  isPublic = false,
  onDecrypt,
  title = copy("identity_card.title_default"),
  subtitle,
  rankLabel,
  streakDays,
  subscriptions = [],
  showStats = true,
  animateTitle = true,
  scrambleDurationMs = 2200,
  scrambleLoop = false,
  scrambleLoopDelayMs = 2400,
  scrambleStartScrambled = true,
  scrambleRespectReducedMotion = false,
  scanlines = true,
  className = "",
  avatarSize = 56,
  animate = true,
}) {
  const unknownLabel = copy("identity_card.unknown");
  const displayName = isPublic ? name : unknownLabel;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const safeAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";
  const showAvatar = isPublic && safeAvatarUrl && !avatarFailed;
  const rankValue = rankLabel ?? copy("identity_card.rank_placeholder");
  const streakValue = Number.isFinite(Number(streakDays))
    ? copy("identity_card.streak_value", { days: Number(streakDays) })
    : copy("identity_card.rank_placeholder");
  const shouldShowStats = showStats && (rankLabel !== undefined || streakDays !== undefined);
  const subscriptionItems = buildSubscriptionItems(subscriptions);

  useEffect(() => {
    setAvatarFailed(false);
  }, [safeAvatarUrl]);

  return (
    <AsciiBox title={title} subtitle={subtitle} className={className}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {showAvatar ? (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              border: "2px solid var(--win-btn-dark-shadow)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src={safeAvatarUrl}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setAvatarFailed(true)}
            />
          </div>
        ) : (
          <Win2KAvatar name={displayName} size={avatarSize} />
        )}

        <div className="flex-1 min-w-0">
          {/* Name */}
          <div
            className="font-bold truncate leading-tight mb-2"
            style={{ fontSize: 14, color: "var(--win-text)" }}
          >
            {displayName}
          </div>

          {/* Decrypt button */}
          {!isPublic && onDecrypt ? (
            <Button
              type="button"
              onClick={onDecrypt}
              className="win-btn win-btn--primary mb-2"
              style={{ fontSize: 11, minWidth: 0 }}
            >
              {copy("identity_card.decrypt")}
            </Button>
          ) : null}

          {/* Stats */}
          {shouldShowStats ? (
            <div className="grid grid-cols-2 gap-1 mt-1">
              <div
                className="p-1 text-center"
                style={{
                  background: "var(--win-sunken)",
                  borderTop: "1px solid var(--win-btn-dark-shadow)",
                  borderLeft: "1px solid var(--win-btn-dark-shadow)",
                  borderBottom: "1px solid var(--win-btn-highlight)",
                  borderRight: "1px solid var(--win-btn-highlight)",
                }}
              >
                <div style={{ fontSize: 9, color: "var(--win-dark)" }}>
                  {copy("identity_card.rank_label")}
                </div>
                <div
                  className="font-bold"
                  style={{ fontSize: 12, color: "var(--win-navy, #000080)" }}
                >
                  {rankValue}
                </div>
              </div>
              <div
                className="p-1 text-center"
                style={{
                  background: "var(--win-sunken)",
                  borderTop: "1px solid var(--win-btn-dark-shadow)",
                  borderLeft: "1px solid var(--win-btn-dark-shadow)",
                  borderBottom: "1px solid var(--win-btn-highlight)",
                  borderRight: "1px solid var(--win-btn-highlight)",
                }}
              >
                <div style={{ fontSize: 9, color: "var(--win-dark)" }}>
                  {copy("identity_card.streak_label")}
                </div>
                <div
                  className="font-bold"
                  style={{ fontSize: 12, color: "var(--win-navy, #000080)" }}
                >
                  {streakValue}
                </div>
              </div>
            </div>
          ) : null}

          {/* Subscriptions */}
          {subscriptionItems.length !== 0 ? (
            <div className="mt-2">
              <div style={{ fontSize: 10, color: "var(--win-dark)", marginBottom: 3 }}>
                {copy("identity_card.subscriptions_label")}
              </div>
              <div className="flex flex-wrap gap-1">
                {subscriptionItems.map((entry, index) => (
                  <span
                    key={`${entry.tool}:${entry.plan}:${index}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "1px 5px",
                      fontSize: 10,
                      background: "var(--win-titlebar)",
                      color: "#ffffff",
                      border: "1px solid var(--win-btn-dark-shadow)",
                    }}
                  >
                    {copy("identity_card.subscription_item", {
                      tool: entry.tool,
                      plan: entry.plan,
                    })}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AsciiBox>
  );
}
