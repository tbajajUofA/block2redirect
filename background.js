const DEFAULT_PRODUCTIVE_SITES = [
    "https://leetcode.com/problemset/",
    "https://github.com/trending",
    "https://developer.mozilla.org",
    "https://www.indeed.com",
    "https://stackoverflow.com"
];

const DEFAULT_SESSION_CONFIG = {
    workMinutes: 25,
    breakMinutes: 5
};

function ensureUrl(value) {

    if (!value) return "";

    const trimmed = value.trim();

    if (!trimmed) return "";

    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    return `https://${trimmed}`;

}

function normalizeHost(value) {

    if (!value) return "";

    let host = value.trim().toLowerCase();

    host = host.replace(/^https?:\/\//, "");
    host = host.replace(/^www\./, "");
    host = host.split("/")[0];

    return host;

}

function hostMatches(hostname, target) {

    const normalizedHost = normalizeHost(hostname);
    const normalizedTarget = normalizeHost(target);

    if (!normalizedHost || !normalizedTarget) return false;

    return (
        normalizedHost === normalizedTarget ||
        normalizedHost.endsWith(`.${normalizedTarget}`)
    );

}

function isWithinSchedule(start, end) {

    const now = new Date();
    let minutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = (start || "00:00").split(":").map(Number);
    const [eh, em] = (end || "23:59").split(":").map(Number);

    const startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;

    // Support overnight windows, e.g. 23:00 -> 06:00.
    if (endMin < startMin) {
        endMin += 24 * 60;
        if (minutes < startMin) {
            minutes += 24 * 60;
        }
    }

    return minutes >= startMin && minutes <= endMin;

}

function trackBlock(site) {

    chrome.storage.local.get(["stats"], (data) => {

        const stats = data.stats || {};

        stats[site] = (stats[site] || 0) + 1;

        chrome.storage.local.set({ stats });

    });

}

function trackAttempt(site) {

    chrome.storage.local.get(["attempts"], (data) => {

        const attempts = data.attempts || {};

        attempts[site] = (attempts[site] || 0) + 1;

        chrome.storage.local.set({ attempts });

    });

}

function shouldPunish(site, threshold, callback) {

    chrome.storage.local.get(["attempts"], (data) => {

        const attempts = data.attempts || {};

        callback((attempts[site] || 0) >= threshold);

    });

}

function resolveSessionState(sessionState, sessionConfig) {

    if (!sessionState || !sessionState.isActive) {
        return sessionState || { isActive: false, phase: "work", endsAt: 0 };
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

    if (!resolved.endsAt) {
        resolved.isActive = false;
    }

    return resolved;

}

function shouldEnforceBlock(timerMode, sessionState, sessionConfig) {

    if (!timerMode) return true;

    const resolved = resolveSessionState(sessionState, sessionConfig);

    if (!resolved.isActive) return false;

    return resolved.phase === "work";

}

function migrateLegacyRules(settings, callback) {

    const hasNewSchema = Array.isArray(settings.blockedSites);

    if (hasNewSchema) {
        callback(settings);
        return;
    }

    const rules = settings.rules || [];
    const blockedSites = [];
    const productiveSites = [...DEFAULT_PRODUCTIVE_SITES];
    const siteMappings = {};

    rules.forEach((rule) => {

        const blocked = normalizeHost(rule.block);
        const redirect = ensureUrl(rule.redirect);

        if (blocked && !blockedSites.includes(blocked)) {
            blockedSites.push(blocked);
        }

        if (blocked && redirect && !siteMappings[blocked]) {
            siteMappings[blocked] = redirect;
        }

        if (redirect && !productiveSites.includes(redirect)) {
            productiveSites.push(redirect);
        }

    });

    const patch = {
        blockedSites,
        productiveSites,
        siteMappings,
        defaultProductiveSite: settings.defaultProductiveSite || productiveSites[0] || DEFAULT_PRODUCTIVE_SITES[0],
        sessionConfig: settings.sessionConfig || DEFAULT_SESSION_CONFIG,
        sessionState: settings.sessionState || { isActive: false, phase: "work", startedAt: 0, endsAt: 0 },
        timerMode: settings.timerMode ?? false
    };

    chrome.storage.sync.set(patch, () => callback({ ...settings, ...patch }));

}

function chooseRedirectUrl(settings, blockedSite, legacyRule) {

    const siteMappings = settings.siteMappings || {};
    const productiveSites = (settings.productiveSites || []).map(ensureUrl).filter(Boolean);
    const mapped = ensureUrl(siteMappings[blockedSite]);
    const defaultProductiveSite = ensureUrl(settings.defaultProductiveSite);
    const forceURL = ensureUrl(settings.forceURL);

    let redirectURL = "";

    if (settings.forceMode && forceURL) {
        redirectURL = forceURL;
    } else if (mapped) {
        redirectURL = mapped;
    } else if (settings.randomMode && productiveSites.length > 0) {
        const randomIndex = Math.floor(Math.random() * productiveSites.length);
        redirectURL = productiveSites[randomIndex];
    } else if (defaultProductiveSite) {
        redirectURL = defaultProductiveSite;
    } else if (legacyRule?.redirect) {
        redirectURL = ensureUrl(legacyRule.redirect);
    } else if (productiveSites.length > 0) {
        redirectURL = productiveSites[0];
    } else {
        redirectURL = DEFAULT_PRODUCTIVE_SITES[0];
    }

    return redirectURL;

}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    if (changeInfo.status !== "loading") return;

    if (!tab.url || !/^https?:/i.test(tab.url)) return;

    let tabHostname = "";

    try {
        tabHostname = new URL(tab.url).hostname;
    } catch (_error) {
        return;
    }

    chrome.storage.sync.get([
        "focusMode",
        "randomMode",
        "forceMode",
        "forceURL",
        "punishmentMode",
        "punishThreshold",
        "rules",
        "blockedSites",
        "productiveSites",
        "siteMappings",
        "defaultProductiveSite",
        "timerMode",
        "sessionConfig",
        "sessionState"
    ], (rawSettings) => {

        migrateLegacyRules(rawSettings, (settings) => {

            if (settings.focusMode === false) return;

            const blockedSites = settings.blockedSites || [];
            const rules = settings.rules || [];

            let blockedSite = blockedSites.find((site) => hostMatches(tabHostname, site));
            let matchedRule = null;

            if (!blockedSite) {
                matchedRule = rules.find((rule) => {
                    return (
                        hostMatches(tabHostname, rule.block) &&
                        isWithinSchedule(rule.start, rule.end)
                    );
                }) || null;

                if (matchedRule) {
                    blockedSite = normalizeHost(matchedRule.block);
                }
            }

            if (!blockedSite) return;

            const sessionState = resolveSessionState(settings.sessionState, settings.sessionConfig);

            if (
                settings.timerMode &&
                settings.sessionState &&
                sessionState.phase !== settings.sessionState.phase
            ) {
                chrome.storage.sync.set({ sessionState });
            }

            if (!shouldEnforceBlock(settings.timerMode, sessionState, settings.sessionConfig)) {
                return;
            }

            trackAttempt(blockedSite);

            shouldPunish(blockedSite, settings.punishThreshold || 5, (punish) => {

                let redirectURL = chooseRedirectUrl(settings, blockedSite, matchedRule);

                if (punish && settings.punishmentMode) {
                    redirectURL = "https://leetcode.com/problemset/";
                }

                if (!redirectURL || tab.url.startsWith(redirectURL)) {
                    return;
                }

                chrome.tabs.update(tabId, { url: redirectURL });

                trackBlock(blockedSite);

            });

        });

    });

});