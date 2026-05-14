/**
 * SHARED HELPER FUNCTIONS
 * 
 * Utility functions used across popup, settings, and background scripts.
 */

/** Normalize input domain: strip protocol, www, subpaths, lowercase */
function normalizeHost(value) {
    if (!value) return "";
    let host = value.trim().toLowerCase();
    host = host.replace(/^https?:\/\//, "");
    host = host.replace(/^www\./, "");
    host = host.split("/")[0];
    return host;
}

/** Ensure URL has protocol (defaults to https://) */
function ensureUrl(value) {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

/** Get favicon URL for a site using Google Favicons API or fallback */
function getFaviconUrl(host, sourceUrl = "") {
    if (host) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    }
    return DEFAULT_FAVICON_FALLBACK;
}

/** Extract hostname from tab URL */
function getTabHostname(tabUrl) {
    if (!tabUrl || !/^https?:\/\//i.test(tabUrl)) return "";
    try {
        return new URL(tabUrl).hostname;
    } catch (_error) {
        return "";
    }
}

/** Check if string looks like a valid hostname (has dot, is localhost, or IP) */
function isLikelyHost(host) {
    if (!host) return false;
    if (host.includes(".")) return true;
    return /^localhost(?::\d+)?$/i.test(host) || /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(host);
}

/** Resolve session state, auto-advancing phases if needed */
function resolveSessionState(sessionState, sessionConfig) {
    if (!sessionState || !sessionState.isActive) {
        return sessionState || { isActive: false, phase: "work", startedAt: 0, endsAt: 0 };
    }
    const now = Date.now();
    const resolved = {
        ...sessionState,
        phase: sessionState.phase === "break" ? "break" : "work"
    };
    const safeConfig = {
        workMinutes: Number(sessionConfig?.workMinutes) || DEFAULT_SESSION_CONFIG.workMinutes,
        breakMinutes: Number(sessionConfig?.breakMinutes) || DEFAULT_SESSION_CONFIG.breakMinutes
    };
    let guard = 0;
    while (resolved.endsAt && now >= resolved.endsAt && guard < 10) {
        if (resolved.phase === "work") {
            resolved.phase = "break";
            resolved.startedAt = resolved.endsAt;
            resolved.endsAt = resolved.startedAt + safeConfig.breakMinutes * 60 * 1000;
        } else {
            resolved.phase = "work";
            resolved.startedAt = resolved.endsAt;
            resolved.endsAt = resolved.startedAt + safeConfig.workMinutes * 60 * 1000;
        }
        guard += 1;
    }
    return resolved;
}

/** Format milliseconds into MM:SS display */
function formatTimeLeft(ms) {
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Get the currently active browser tab */
function getCurrentTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        callback(Array.isArray(tabs) ? tabs[0] || null : null);
    });
}

/** Get default productive site from storage */
function getDefaultProductiveSite() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["defaultProductiveSite", "productiveSites"], (data) => {
            const defaultSite = data.defaultProductiveSite || data.productiveSites?.[0] || DEFAULT_PRODUCTIVE_SITES[0];
            resolve(ensureUrl(defaultSite));
        });
    });
}
