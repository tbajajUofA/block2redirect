/**
 * POPUP SCRIPT
 * 
 * Manages the quick-access popup interface for blocking sites.
 * 
 * Main Functions:
 * - addBlockedSite(): Validates typed input and adds to blocked list
 * - blockCurrentSite(): Blocks the active browser tab's site immediately
 * - validateAndAdd(): Centralized validation for both entry paths
 * - renderBlockedSites(): Renders list with favicons from metadata
 * 
 * Validation Flow:
 * 1. normalizeHost(input) → strips protocol, www, subpaths
 * 2. isLikelyHost(host) → checks for domain pattern or localhost
 * 3. checkSiteExists(host) → HTTP GET probe to verify reachability
 * 4. saveBlockedSite() → stores site and metadata (favicon, title, source URL)
 * 
 * On-Block Behavior:
 * - Checks if blocked site is active tab
 * - If yes, immediately redirects using redirectTabIfBlocked()
 * - If no, just adds to list
 * 
 * Storage Schema:
 * - blockedSites: string[] (hostnames)
 * - blockedSiteMeta: { [host]: { faviconUrl, sourceUrl, title } }
 * - siteMappings: { [host]: redirectUrl } (per-site redirect mapping)
 */

const blockedSiteInput = document.getElementById("blockedSite");
const addBlockedSiteButton = document.getElementById("addBlockedSite");
const blockCurrentSiteButton = document.getElementById("blockCurrentSite");
const blockedSitesList = document.getElementById("blockedSitesList");
const statusMessage = document.getElementById("statusMessage");
 
// Toggle elements may not exist in the popup, but ensure variables are declared
// so references later in the script do not throw ReferenceError.
const focusToggle = document.getElementById("focusToggle");
const randomToggle = document.getElementById("randomToggle");
const punishToggle = document.getElementById("punishToggle");
const timerToggle = document.getElementById("timerToggle");

const DEFAULT_FAVICON_FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="12" fill="#0f172a"/>
        <path d="M20 18h24a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H28l-8 8V24a6 6 0 0 1 6-6Z" fill="#22d3ee"/>
    </svg>
`);

const PLACEHOLDER_EXAMPLES = [
    "Try blocking x.com",
    "blockexample.com (won't work, just an example)",
    "Block youtube.com",
    "Enter a site like github.com",
    "Type a domain to block",
    "something funny.com (probably doesn't exist)"
];

function setRandomPlaceholder() {
    /*
    Keeps the UI fresh by rotating through example placeholders
    each time the popup is opened.
    */

    if (!blockedSiteInput) {return;} 

    const nextPlaceholder = PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)];
    blockedSiteInput.placeholder = nextPlaceholder;

}

function getTabHostname(tabUrl) {
    /*
    Extracts the hostname from a tab URL for comparison against blocked sites.
    */

    if (!tabUrl || !/^https?:\/\//i.test(tabUrl)) return "";

    try {
        return new URL(tabUrl).hostname;
    } catch (_error) {
        return "";
    }

}

function getDefaultProductiveSite() {

    return new Promise((resolve) => {
        chrome.storage.sync.get(["defaultProductiveSite", "productiveSites"], (data) => {
            const defaultSite = data.defaultProductiveSite || data.productiveSites?.[0] || "https://leetcode.com/problemset/";
            resolve(ensureUrl(defaultSite));
        });
    });

}

async function redirectTabIfBlocked(host, tabId, tabUrl) {

    if (!host || !tabId || !tabUrl || !/^https?:/i.test(tabUrl)) return;

    const defaultRedirect = await getDefaultProductiveSite();

    if (!defaultRedirect || tabUrl.startsWith(defaultRedirect)) {
        return;
    }

    chrome.tabs.update(tabId, { url: defaultRedirect });

}

function normalizeHost(value) {

    if (!value) return "";

    let host = value.trim().toLowerCase();

    host = host.replace(/^https?:\/\//, "");
    host = host.replace(/^www\./, "");
    host = host.split("/")[0];

    return host;

}

function ensureUrl(value) {

    if (!value) return "";

    const trimmed = value.trim();

    if (!trimmed) return "";

    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    return `https://${trimmed}`;

}

function getFaviconUrl(host, sourceUrl = "") {

    if (host) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    }

    return DEFAULT_FAVICON_FALLBACK;

}

function setStatus(message, kind = "info") {

    if (!statusMessage) return;

    statusMessage.textContent = message || "";
    statusMessage.dataset.kind = kind;

}

function isLikelyHost(host) {

    if (!host) return false;

    if (host.includes(".")) return true;

    return /^localhost(?::\d+)?$/i.test(host) || /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(host);

}

function checkSiteExists(host) {

    const candidateUrls = [
        `https://${host}`,
        `http://${host}`
    ];

    return new Promise((resolve) => {

        let finished = false;

        const done = (value) => {
            if (finished) return;
            finished = true;
            resolve(value);
        };

        const timeoutId = setTimeout(() => done(false), 4500);

        const tryNext = (index) => {
            if (index >= candidateUrls.length) {
                clearTimeout(timeoutId);
                done(false);
                return;
            }

            fetch(candidateUrls[index], {
                method: "GET",
                mode: "no-cors",
                cache: "no-store"
            }).then(() => {
                clearTimeout(timeoutId);
                done(true);
            }).catch(() => {
                tryNext(index + 1);
            });
        };

        tryNext(0);

    });

}

function readBlockedSiteData(callback) {

    chrome.storage.sync.get(["blockedSites", "blockedSiteMeta", "siteMappings"], (data) => {
        callback({
            blockedSites: data.blockedSites || [],
            blockedSiteMeta: data.blockedSiteMeta || {},
            siteMappings: data.siteMappings || {}
        });
    });

}

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

function getCurrentTab(callback) {

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        callback(Array.isArray(tabs) ? tabs[0] || null : null);
    });

}

function renderBlockedSites() {

    chrome.storage.sync.get(["blockedSites", "blockedSiteMeta"], (data) => {

        const blockedSites = data.blockedSites || [];
        const blockedSiteMeta = data.blockedSiteMeta || {};

        blockedSitesList.innerHTML = "";

        blockedSites.forEach((site, index) => {

            const meta = blockedSiteMeta[site] || {};
            const li = document.createElement("li");
            const faviconUrl = meta.faviconUrl || getFaviconUrl(site, meta.sourceUrl || ensureUrl(site));

            li.innerHTML = `
                <div class="site-entry">
                    <img class="site-icon" src="${faviconUrl}" alt="${site} icon" onerror="this.src='${DEFAULT_FAVICON_FALLBACK}'">
                    <div class="site-labels">
                        <span class="site-host">${site}</span>
                        <span class="site-source">${meta.title || meta.sourceUrl || 'Blocked site'}</span>
                    </div>
                </div>
                <button data-index="${index}" type="button">X</button>
            `;

            blockedSitesList.appendChild(li);

        });

        document.querySelectorAll("button[data-index]").forEach((btn) => {
            btn.onclick = () => removeBlockedSite(Number(btn.dataset.index));
        });

    });

}

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
        const productiveSites = [];
        const siteMappings = {};

        rules.forEach((rule) => {
            const blocked = normalizeHost(rule.block);
            const redirect = (rule.redirect || "").trim();

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
            defaultProductiveSite: data.defaultProductiveSite || productiveSites[0] || "https://leetcode.com/problemset/",
            sessionConfig: data.sessionConfig || { workMinutes: 25, breakMinutes: 5 },
            sessionState: data.sessionState || { isActive: false, phase: "work", startedAt: 0, endsAt: 0 },
            timerMode: data.timerMode ?? false
        }, callback);
    });

}

function loadBlockedSites() {
    renderBlockedSites();

}

function removeBlockedSite(index) {

    chrome.storage.sync.get(["blockedSites", "siteMappings", "blockedSiteMeta"], (data) => {

        const blockedSites = data.blockedSites || [];
        const siteMappings = data.siteMappings || {};
        const blockedSiteMeta = data.blockedSiteMeta || {};

        const [removed] = blockedSites.splice(index, 1);

        if (removed) {
            delete siteMappings[removed];
            delete blockedSiteMeta[removed];
        }

        chrome.storage.sync.set({ blockedSites, siteMappings, blockedSiteMeta }, loadBlockedSites);

    });

}

async function addBlockedSite() {

    const blockedSite = normalizeHost(blockedSiteInput.value);

    if (!blockedSite) {
        setStatus("Enter a site to block.", "error");
        return;
    }

    if (!isLikelyHost(blockedSite)) {
        setStatus("That does not look like a valid site.", "error");
        return;
    }

    setStatus(`Checking ${blockedSite}...`);

    const exists = await checkSiteExists(blockedSite);

    if (!exists) {
        setStatus("That site could not be reached. Check the spelling and try again.", "error");
        return;
    }

    getCurrentTab((currentTab) => {
        saveBlockedSite(blockedSite, {
            sourceUrl: ensureUrl(blockedSite),
            faviconUrl: getFaviconUrl(blockedSite, ensureUrl(blockedSite)),
            title: blockedSite
        }, () => {
            blockedSiteInput.value = "";
            setStatus(`${blockedSite} added to blocked sites.`);
            loadBlockedSites();
            if (currentTab && currentTab.id && currentTab.url && getTabHostname(currentTab.url) === blockedSite) {
                redirectTabIfBlocked(blockedSite, currentTab.id, currentTab.url);
            }
        });
    });

}

function blockCurrentSite() {

    getCurrentTab((tab) => {

        if (!tab || !tab.url) {
            setStatus("Open a web page first.", "error");
            return;
        }

        if (!/^https?:\/\//i.test(tab.url)) {
            setStatus("That tab cannot be blocked from here.", "error");
            return;
        }

        let host = "";

        try {
            host = new URL(tab.url).hostname;
        } catch (_error) {
            setStatus("Could not read the current site.", "error");
            return;
        }

        if (!host) {
            setStatus("Could not read the current site.", "error");
            return;
        }

        saveBlockedSite(host, {
            sourceUrl: tab.url,
            faviconUrl: tab.favIconUrl || getFaviconUrl(host, tab.url),
            title: tab.title || host
        }, () => {
            setStatus(`${host} blocked from the current tab.`);
            loadBlockedSites();
            redirectTabIfBlocked(host, tab.id, tab.url);
        });

    });

}

addBlockedSiteButton.onclick = addBlockedSite;
if (blockCurrentSiteButton) {
    blockCurrentSiteButton.onclick = blockCurrentSite;
}

blockedSiteInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        event.preventDefault();
        addBlockedSite();
    }

});

document.getElementById("settingsButton").onclick = () => {

    chrome.tabs.create({
        url: chrome.runtime.getURL("settings/settings.html")
    });

};

chrome.storage.sync.get([
    "focusMode",
    "randomMode",
    "punishmentMode",
    "timerMode"
], (data) => {

    if (focusToggle) focusToggle.checked = data.focusMode ?? true;
    if (randomToggle) randomToggle.checked = data.randomMode ?? true;
    if (punishToggle) punishToggle.checked = data.punishmentMode ?? false;
    if (timerToggle) timerToggle.checked = data.timerMode ?? false;

});

if (focusToggle) focusToggle.onchange = () => chrome.storage.sync.set({ focusMode: focusToggle.checked });
if (randomToggle) randomToggle.onchange = () => chrome.storage.sync.set({ randomMode: randomToggle.checked });
if (punishToggle) punishToggle.onchange = () => chrome.storage.sync.set({ punishmentMode: punishToggle.checked });
if (timerToggle) timerToggle.onchange = () => chrome.storage.sync.set({ timerMode: timerToggle.checked });

migrateLegacyRules(loadBlockedSites);
setRandomPlaceholder();

