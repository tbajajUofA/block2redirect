/**
 * SHARED STORAGE OPERATIONS
 * 
 * Chrome storage read/write functions used across popup and settings.
 */

/** Read blocked site data from storage */
function readBlockedSiteData(callback) {
    chrome.storage.sync.get(["blockedSites", "blockedSiteMeta", "siteMappings"], (data) => {
        callback({
            blockedSites: data.blockedSites || [],
            blockedSiteMeta: data.blockedSiteMeta || {},
            siteMappings: data.siteMappings || {}
        });
    });
}

/** Save a blocked site with favicon metadata */
function saveBlockedSite(host, meta, callback) {
    readBlockedSiteData((data) => {
        const blockedSites = data.blockedSites.slice();
        const blockedSiteMeta = { ...data.blockedSiteMeta };

        if (!blockedSites.includes(host)) {
            blockedSites.push(host);
        }

        blockedSiteMeta[host] = {
            host,
            sourceUrl: meta?.sourceUrl || ensureUrl(host),
            faviconUrl: meta?.faviconUrl || getFaviconUrl(host, meta?.sourceUrl || ensureUrl(host)),
            title: meta?.title || host
        };

        chrome.storage.sync.set({ blockedSites, blockedSiteMeta }, () => {
            if (typeof callback === "function") {
                callback();
            }
        });
    });
}

/** Remove a blocked site at index and clean up mappings */
function removeBlockedSite(index, callback) {
    chrome.storage.sync.get(["blockedSites", "siteMappings", "blockedSiteMeta"], (data) => {
        const blockedSites = data.blockedSites || [];
        const siteMappings = data.siteMappings || {};
        const blockedSiteMeta = data.blockedSiteMeta || {};
        const [removed] = blockedSites.splice(index, 1);
        if (removed) {
            delete siteMappings[removed];
            delete blockedSiteMeta[removed];
        }
        chrome.storage.sync.set({ blockedSites, siteMappings, blockedSiteMeta }, () => {
            if (typeof callback === "function") {
                callback();
            }
        });
    });
}

/** Migrate legacy rules format to new storage schema */
function migrateLegacyRules(callback) {
    chrome.storage.sync.get([
        "rules",
        "blockedSites",
        "productiveSites",
        "siteMappings",
        "defaultProductiveSite",
        "sessionConfig",
        "sessionState",
        "timerMode",
        "blockedSiteMeta"
    ], (data) => {
        if (Array.isArray(data.blockedSites)) {
            callback();
            return;
        }

        const rules = data.rules || [];
        const blockedSites = [];
        const productiveSites = [...DEFAULT_PRODUCTIVE_SITES];
        const siteMappings = {};

        rules.forEach((rule) => {
            const blocked = normalizeHost(rule.block);
            const redirect = ensureUrl(rule.redirect);
            if (blocked && !blockedSites.includes(blocked)) {
                blockedSites.push(blocked);
            }
            if (redirect && !productiveSites.includes(redirect)) {
                productiveSites.push(redirect);
            }
            if (blocked && redirect && !siteMappings[blocked]) {
                siteMappings[blocked] = redirect;
            }
        });

        chrome.storage.sync.set({
            blockedSites,
            productiveSites,
            siteMappings,
            blockedSiteMeta: data.blockedSiteMeta || {},
            defaultProductiveSite: productiveSites.includes(ensureUrl(data.defaultProductiveSite))
                ? ensureUrl(data.defaultProductiveSite)
                : productiveSites[0] || DEFAULT_PRODUCTIVE_SITES[0],
            sessionConfig: data.sessionConfig || DEFAULT_SESSION_CONFIG,
            sessionState: data.sessionState || { isActive: false, phase: "work", startedAt: 0, endsAt: 0 },
            timerMode: data.timerMode ?? false
        }, callback);
    });
}
