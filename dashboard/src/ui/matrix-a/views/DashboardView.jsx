import { Button } from "@base-ui/react/button";
import React from "react";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";
import { MatrixButton } from "../../foundation/MatrixButton.jsx";
import { MatrixShell } from "../../foundation/MatrixShell.jsx";
import { CostAnalysisModal } from "../components/CostAnalysisModal.jsx";
import { IdentityCard } from "../components/IdentityCard.jsx";
import { NeuralDivergenceMap } from "../components/NeuralDivergenceMap.jsx";
import { RollingUsagePanel } from "../components/RollingUsagePanel.jsx";
import { TopModelsPanel } from "../components/TopModelsPanel.jsx";
import { TrendMonitor } from "../components/TrendMonitor.jsx";
import { UsagePanel } from "../components/UsagePanel.jsx";

export function DashboardView(props) {
  const {
    copy,
    headerStatus,
    headerRight,
    footerLeftContent,
    screenshotMode,
    publicViewInvalid,
    publicViewInvalidTitle,
    publicViewInvalidBody,
    showExpiredGate,
    showAuthGate,
    sessionExpiredCopied,
    sessionExpiredCopiedLabel,
    sessionExpiredCopyLabel,
    handleCopySessionExpired,
    signInUrl,
    signUpUrl,
    screenshotTitleLine1,
    screenshotTitleLine2,
    identityDisplayName,
    identityStartDate,
    activeDays,
    identitySubscriptions,
    identityScrambleDurationMs,
    projectUsageBlock,
    topModels,
    signedIn,
    publicMode,
    shouldShowInstall,
    installPrompt,
    handleCopyInstall,
    installCopied,
    installCopiedLabel,
    installCopyLabel,
    installInitCmdDisplay,
    linkCodeLoading,
    linkCodeError,
    publicViewTitle,
    handleTogglePublicView,
    publicViewBusy,
    publicViewEnabled,
    publicViewToggleLabel,
    publicViewStatusLabel,
    publicViewCopyButtonLabel,
    handleCopyPublicView,
    trendRowsForDisplay,
    trendFromForDisplay,
    trendToForDisplay,
    period,
    trendTimeZoneLabel,
    activityHeatmapBlock,
    isCapturing,
    handleShareToX,
    screenshotTwitterLabel,
    screenshotTwitterButton,
    screenshotTwitterHint,
    periodsForDisplay,
    setSelectedPeriod,
    metricsRows,
    summaryLabel,
    summaryValue,
    summaryCostValue,
    rollingUsage,
    costInfoEnabled,
    openCostModal,
    allowBreakdownToggle,
    coreIndexCollapsed,
    setCoreIndexCollapsed,
    coreIndexCollapseLabel,
    coreIndexExpandLabel,
    coreIndexCollapseAria,
    coreIndexExpandAria,
    refreshAll,
    usagePanelLoading,
    usagePanelRefreshing,
    usageError,
    rangeLabel,
    timeZoneRangeLabel,
    usageSourceLabel,
    fleetData,
    hasDetailsActual,
    dailyEmptyPrefix,
    installSyncCmd,
    dailyEmptySuffix,
    detailsColumns,
    ariaSortFor,
    toggleSort,
    sortIconFor,
    pagedDetails,
    detailsDateKey,
    renderDetailDate,
    renderDetailCell,
    DETAILS_PAGED_PERIODS,
    detailsPageCount,
    detailsPage,
    setDetailsPage,
    costModalOpen,
    closeCostModal,
  } = props;

  return (
    <>
      <MatrixShell
        hideHeader={screenshotMode}
        headerStatus={headerStatus}
        headerRight={headerRight}
        footerLeft={footerLeftContent ? <span>{footerLeftContent}</span> : null}
        footerRight={<span className="font-bold">{copy("dashboard.footer.right")}</span>}
        contentClassName=""
        rootClassName={screenshotMode ? "screenshot-mode" : ""}
      >
        {publicViewInvalid ? (
          <div className="mb-3">
            <AsciiBox title={publicViewInvalidTitle}>
              <p style={{ fontSize: 11, color: "var(--win-dark)", margin: 0 }}>{publicViewInvalidBody}</p>
            </AsciiBox>
          </div>
        ) : null}
        {showExpiredGate ? (
          <div className="mb-3">
            <AsciiBox
              title={copy("dashboard.session_expired.title")}
              subtitle={copy("dashboard.session_expired.subtitle")}
            >
              <p className="flex flex-wrap items-center gap-2" style={{ fontSize: 11, margin: 0 }}>
                <span style={{ color: "var(--win-dark)" }}>{copy("dashboard.session_expired.body")}</span>
                <MatrixButton
                  onClick={handleCopySessionExpired}
                >
                  {sessionExpiredCopied ? sessionExpiredCopiedLabel : sessionExpiredCopyLabel}
                </MatrixButton>
                <span style={{ color: "var(--win-dark)" }}>{copy("dashboard.session_expired.body_tail")}</span>
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <MatrixButton as="a" primary href={signInUrl}>
                  {copy("shared.button.sign_in")}
                </MatrixButton>
                <MatrixButton as="a" href={signUpUrl}>
                  {copy("shared.button.sign_up")}
                </MatrixButton>
              </div>
            </AsciiBox>
          </div>
        ) : showAuthGate ? (
          <div className="flex items-center justify-center">
            <AsciiBox
              title={copy("dashboard.auth_required.title")}
              subtitle={copy("dashboard.auth_required.subtitle")}
              className="w-full max-w-2xl"
            >
              <p style={{ fontSize: 11, color: "var(--win-dark)", margin: 0 }}>{copy("dashboard.auth_required.body")}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <MatrixButton as="a" primary href={signInUrl}>
                  {copy("shared.button.sign_in")}
                </MatrixButton>
                <MatrixButton as="a" href={signUpUrl}>
                  {copy("shared.button.sign_up")}
                </MatrixButton>
              </div>
            </AsciiBox>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
                {screenshotMode ? (
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex flex-col gap-1">
                      <span
                        className="font-bold leading-none"
                        style={{ fontSize: "clamp(24px, 4vw, 36px)", color: "var(--win-navy, #000080)" }}
                      >
                        {screenshotTitleLine1}
                      </span>
                      <span
                        className="font-bold leading-none"
                        style={{ fontSize: "clamp(18px, 3vw, 28px)", color: "var(--win-navy, #000080)" }}
                      >
                        {screenshotTitleLine2}
                      </span>
                    </div>
                  </div>
                ) : null}
                <IdentityCard
                  title={copy("dashboard.identity.title")}
                  subtitle={copy("dashboard.identity.subtitle")}
                  name={identityDisplayName}
                  avatarUrl={null}
                  isPublic
                  rankLabel={identityStartDate ?? copy("identity_card.rank_placeholder")}
                  streakDays={activeDays}
                  subscriptions={identitySubscriptions}
                  animateTitle={false}
                  scrambleDurationMs={identityScrambleDurationMs}
                />

                <RollingUsagePanel rolling={rollingUsage} />

                <TopModelsPanel rows={topModels} />

                {!screenshotMode && !signedIn && !publicMode ? (
                  <AsciiBox
                    title={copy("dashboard.auth_optional.title")}
                    subtitle={copy("dashboard.auth_optional.subtitle")}
                  >
                    <p style={{ fontSize: 11, color: "var(--win-dark)", margin: 0 }}>
                      {copy("dashboard.auth_optional.body")}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <MatrixButton as="a" primary href={signInUrl}>
                        {copy("shared.button.sign_in")}
                      </MatrixButton>
                      <MatrixButton as="a" href={signUpUrl}>
                        {copy("shared.button.sign_up")}
                      </MatrixButton>
                    </div>
                  </AsciiBox>
                ) : null}

                {shouldShowInstall ? (
                  <AsciiBox
                    title={copy("dashboard.install.title")}
                    subtitle={copy("dashboard.install.subtitle")}
                    className="relative"
                  >
                    <div className="mb-2" style={{ fontSize: 11, color: "var(--win-text)", fontWeight: "bold" }}>
                      {installPrompt}
                    </div>
                    <div className="flex flex-col gap-2">
                      <MatrixButton
                        onClick={handleCopyInstall}
                        aria-label={installCopied ? installCopiedLabel : installCopyLabel}
                        title={installCopied ? installCopiedLabel : installCopyLabel}
                        className="w-full justify-between gap-2"
                        style={{ minWidth: 0, fontSize: 11, fontFamily: '"Courier New", monospace', textAlign: "left" }}
                      >
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 11 }}>
                          {installInitCmdDisplay}
                        </span>
                        <span style={{ fontSize: 10 }}>
                          {installCopied ? "Copied!" : "Copy"}
                        </span>
                      </MatrixButton>
                      {linkCodeLoading ? (
                        <span style={{ fontSize: 11, color: "var(--win-dark)" }}>
                          {copy("dashboard.install.link_code.loading")}
                        </span>
                      ) : linkCodeError ? (
                        <span style={{ fontSize: 11, color: "#cc0000" }}>
                          {copy("dashboard.install.link_code.failed")}
                        </span>
                      ) : null}
                    </div>
                  </AsciiBox>
                ) : null}

                {!screenshotMode && signedIn && !publicMode ? (
                  <AsciiBox title={publicViewTitle} className="relative">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              onClick={handleTogglePublicView}
                              disabled={publicViewBusy}
                              aria-pressed={publicViewEnabled}
                              aria-label={publicViewToggleLabel}
                              title={publicViewToggleLabel}
                              className="win-btn"
                              style={{
                                minWidth: 0,
                                padding: "2px 8px",
                                fontSize: 11,
                                background: publicViewEnabled ? "var(--win-highlight)" : "var(--win-btn-face)",
                                color: publicViewEnabled ? "var(--win-highlight-text)" : "var(--win-text)",
                              }}
                            >
                              {publicViewEnabled ? "ON" : "OFF"}
                            </Button>
                            <span style={{ fontSize: 11, color: "var(--win-text)" }}>
                              {publicViewStatusLabel}
                            </span>
                          </div>
                          <MatrixButton
                            onClick={handleCopyPublicView}
                            disabled={!publicViewEnabled || publicViewBusy}
                          >
                            {publicViewCopyButtonLabel}
                          </MatrixButton>
                        </div>
                    </div>
                  </AsciiBox>
                ) : null}

                {!screenshotMode ? (
                  <TrendMonitor
                    rows={trendRowsForDisplay}
                    from={trendFromForDisplay}
                    to={trendToForDisplay}
                    period={period}
                    timeZoneLabel={trendTimeZoneLabel}
                    showTimeZoneLabel={false}
                    className="h-auto min-h-[280px]"
                  />
                ) : null}

                {activityHeatmapBlock}
                {screenshotMode ? (
                  <div
                    className="mt-4 flex flex-col items-center gap-2"
                    data-screenshot-exclude="true"
                    style={isCapturing ? { display: "none" } : undefined}
                  >
                    <MatrixButton
                      type="button"
                      onClick={handleShareToX}
                      aria-label={screenshotTwitterLabel}
                      title={screenshotTwitterLabel}
                      className="h-12 md:h-14 px-6 text-base tracking-[0.25em]"
                      primary
                      disabled={isCapturing}
                    >
                      {screenshotTwitterButton}
                    </MatrixButton>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-matrix-muted">
                      {screenshotTwitterHint}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
                {projectUsageBlock}

                <UsagePanel
                  title={copy("usage.panel.title")}
                  period={period}
                  periods={periodsForDisplay}
                  onPeriodChange={setSelectedPeriod}
                  metrics={metricsRows}
                  showSummary={period === "total"}
                  useSummaryLayout
                  summaryLabel={summaryLabel}
                  summaryValue={summaryValue}
                  summaryCostValue={summaryCostValue}
                  onCostInfo={costInfoEnabled ? openCostModal : null}
                  breakdownCollapsed={allowBreakdownToggle ? coreIndexCollapsed : true}
                  onToggleBreakdown={
                    allowBreakdownToggle ? () => setCoreIndexCollapsed((value) => !value) : null
                  }
                  collapseLabel={allowBreakdownToggle ? coreIndexCollapseLabel : undefined}
                  expandLabel={allowBreakdownToggle ? coreIndexExpandLabel : undefined}
                  collapseAriaLabel={allowBreakdownToggle ? coreIndexCollapseAria : undefined}
                  expandAriaLabel={allowBreakdownToggle ? coreIndexExpandAria : undefined}
                  onRefresh={screenshotMode ? null : refreshAll}
                  loading={usagePanelLoading}
                  refreshing={usagePanelRefreshing}
                  error={usageError}
                  rangeLabel={screenshotMode ? null : rangeLabel}
                  rangeTimeZoneLabel={timeZoneRangeLabel}
                  statusLabel={screenshotMode ? null : usageSourceLabel}
                  summaryScrambleDurationMs={identityScrambleDurationMs}
                  summaryAnimate={false}
                />

                <NeuralDivergenceMap fleetData={fleetData} className="min-w-0" footer={null} />

                {!screenshotMode ? (
                  <AsciiBox
                    title={copy("dashboard.daily.title")}
                    subtitle={copy("dashboard.daily.subtitle")}
                  >
                    {!hasDetailsActual ? (
                      <div className="mb-2" style={{ fontSize: 11, color: "var(--win-dark)" }}>
                        {dailyEmptyPrefix}
                        <code
                          style={{
                            fontFamily: '"Courier New", monospace',
                            background: "var(--win-sunken)",
                            border: "1px solid var(--win-btn-dark-shadow)",
                            padding: "0 4px",
                          }}
                        >
                          {installSyncCmd}
                        </code>
                        {dailyEmptySuffix}
                      </div>
                    ) : null}
                    <div
                      className="overflow-auto max-h-[520px] win-scrollbar"
                      role="region"
                      aria-label={copy("daily.table.aria_label")}
                      tabIndex={0}
                      style={{
                        background: "var(--win-sunken)",
                        borderTop: "1px solid var(--win-btn-dark-shadow)",
                        borderLeft: "1px solid var(--win-btn-dark-shadow)",
                        borderBottom: "1px solid var(--win-btn-highlight)",
                        borderRight: "1px solid var(--win-btn-highlight)",
                      }}
                    >
                      <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: '"Tahoma", "MS Sans Serif", sans-serif' }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--win-btn-face)" }}>
                          <tr>
                            {detailsColumns.map((c) => (
                              <th
                                key={c.key}
                                aria-sort={ariaSortFor(c.key)}
                                className="win-listview-header"
                                style={{ textAlign: "left" }}
                              >
                                <Button
                                  type="button"
                                  onClick={() => toggleSort(c.key)}
                                  title={c.title}
                                  className="w-full text-left focus:outline-none"
                                  style={{
                                    padding: "2px 6px",
                                    fontSize: 11,
                                    fontFamily: '"Tahoma", sans-serif',
                                    fontWeight: "bold",
                                    cursor: "default",
                                    background: "transparent",
                                    border: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    color: "var(--win-text)",
                                  }}
                                >
                                  <span>{c.label}</span>
                                  <span style={{ color: "var(--win-dark)", fontSize: 9 }}>{sortIconFor(c.key)}</span>
                                </Button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedDetails.map((r) => (
                            <tr
                              key={String(
                                r?.[detailsDateKey] || r?.day || r?.hour || r?.month || "",
                              )}
                              className="win-listview-row"
                              style={
                                r.missing
                                  ? { color: "var(--win-dark)" }
                                  : r.future
                                  ? { color: "var(--win-dark)", opacity: 0.5 }
                                  : {}
                              }
                            >
                              <td className="px-4" style={{ padding: "2px 6px", fontFamily: '"Courier New", monospace', fontSize: 11, borderRight: "1px solid var(--win-btn-shadow)" }}>
                                {renderDetailDate(r)}
                              </td>
                              <td style={{ padding: "2px 6px", fontFamily: '"Courier New", monospace', fontSize: 11, textAlign: "right" }}>
                                {renderDetailCell(r, "total_tokens")}
                              </td>
                              <td style={{ padding: "2px 6px", fontFamily: '"Courier New", monospace', fontSize: 11, textAlign: "right" }}>
                                {renderDetailCell(r, "input_tokens")}
                              </td>
                              <td style={{ padding: "2px 6px", fontFamily: '"Courier New", monospace', fontSize: 11, textAlign: "right" }}>
                                {renderDetailCell(r, "output_tokens")}
                              </td>
                              <td style={{ padding: "2px 6px", fontFamily: '"Courier New", monospace', fontSize: 11, textAlign: "right" }}>
                                {renderDetailCell(r, "cached_input_tokens")}
                              </td>
                              <td style={{ padding: "2px 6px", fontFamily: '"Courier New", monospace', fontSize: 11, textAlign: "right" }}>
                                {renderDetailCell(r, "reasoning_output_tokens")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {DETAILS_PAGED_PERIODS.has(period) && detailsPageCount > 1 ? (
                      <div className="flex items-center justify-between mt-2" style={{ fontSize: 11 }}>
                        <MatrixButton
                          type="button"
                          onClick={() => setDetailsPage((prev) => Math.max(0, prev - 1))}
                          disabled={detailsPage === 0}
                        >
                          {copy("details.pagination.prev")}
                        </MatrixButton>
                        <span style={{ color: "var(--win-dark)" }}>
                          {copy("details.pagination.page", {
                            page: detailsPage + 1,
                            total: detailsPageCount,
                          })}
                        </span>
                        <MatrixButton
                          type="button"
                          onClick={() =>
                            setDetailsPage((prev) => Math.min(detailsPageCount - 1, prev + 1))
                          }
                          disabled={detailsPage + 1 >= detailsPageCount}
                        >
                          {copy("details.pagination.next")}
                        </MatrixButton>
                      </div>
                    ) : null}
                  </AsciiBox>
                ) : null}
              </div>
            </div>
          </>
        )}
      </MatrixShell>
      <CostAnalysisModal isOpen={costModalOpen} onClose={closeCostModal} fleetData={fleetData} />
    </>
  );
}
