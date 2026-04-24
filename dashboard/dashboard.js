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

const blockedSiteInput = document.getElementById("blockedSiteInput");
const addBlockedBtn = document.getElementById("addBlockedBtn");
const blockedSitesList = document.getElementById("blockedSitesList");

const productiveSiteInput = document.getElementById("productiveSiteInput");
const addProductiveBtn = document.getElementById("addProductiveBtn");
const productiveSitesList = document.getElementById("productiveSitesList");
const defaultProductiveSelect = document.getElementById("defaultProductiveSelect");
const saveDefaultBtn = document.getElementById("saveDefaultBtn");

const mappingList = document.getElementById("mappingList");

const focusToggle = document.getElementById("focusToggle");
const randomToggle = document.getElementById("randomToggle");
const punishToggle = document.getElementById("punishToggle");
const timerToggle = document.getElementById("timerToggle");
const punishThresholdInput = document.getElementById("punishThresholdInput");
const saveThresholdBtn = document.getElementById("saveThresholdBtn");

const workMinutesInput = document.getElementById("workMinutesInput");
const breakMinutesInput = document.getElementById("breakMinutesInput");
const saveSessionConfigBtn = document.getElementById("saveSessionConfigBtn");
const startSessionBtn = document.getElementById("startSessionBtn");
const stopSessionBtn = document.getElementById("stopSessionBtn");
const sessionStatus = document.getElementById("sessionStatus");

const statsList = document.getElementById("statsList");

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

function formatTimeLeft(ms) {

    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

}

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

function migrateLegacyRules(callback) {

    chrome.storage.sync.get([
        "rules",
        "blockedSites",
        "productiveSites",
        "siteMappings",
        "defaultProductiveSite",
        "sessionConfig",
        "sessionState",
        "timerMode"
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
            defaultProductiveSite: data.defaultProductiveSite || productiveSites[0] || DEFAULT_PRODUCTIVE_SITES[0],
            sessionConfig: data.sessionConfig || DEFAULT_SESSION_CONFIG,
            sessionState: data.sessionState || { isActive: false, phase: "work", startedAt: 0, endsAt: 0 },
            timerMode: data.timerMode ?? false
        }, callback);
    });

}

function loadStats() {

    chrome.storage.local.get(["stats"], (data) => {

        const stats = data.stats || {};
        const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);

        statsList.innerHTML = "";

        if (entries.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No blocked attempts recorded yet.";
            statsList.appendChild(li);
            return;
        }

        entries.forEach(([site, count]) => {
            const li = document.createElement("li");
            li.innerHTML = `<b>${site}</b><span>${count} blocks</span>`;
            statsList.appendChild(li);
        });

    });

}

function renderState() {

    chrome.storage.sync.get([
        "blockedSites",
        "productiveSites",
        "siteMappings",
        "defaultProductiveSite",
        "focusMode",
        "randomMode",
        "punishmentMode",
        "timerMode",
        "punishThreshold",
        "sessionConfig",
        "sessionState"
    ], (data) => {

        const blockedSites = data.blockedSites || [];
        const productiveSites = (data.productiveSites || DEFAULT_PRODUCTIVE_SITES).map(ensureUrl).filter(Boolean);
        const siteMappings = data.siteMappings || {};
        const defaultProductiveSite = ensureUrl(data.defaultProductiveSite || productiveSites[0] || DEFAULT_PRODUCTIVE_SITES[0]);

        blockedSitesList.innerHTML = "";

        blockedSites.forEach((site, index) => {
            const li = document.createElement("li");
            li.innerHTML = `<b>${site}</b><button data-remove-blocked="${index}">Remove</button>`;
            blockedSitesList.appendChild(li);
        });

        document.querySelectorAll("button[data-remove-blocked]").forEach((btn) => {
            btn.onclick = () => removeBlockedSite(Number(btn.dataset.removeBlocked));
        });

        productiveSitesList.innerHTML = "";

        productiveSites.forEach((site, index) => {
            const li = document.createElement("li");
            li.innerHTML = `<span>${site}</span><button data-remove-productive="${index}">Remove</button>`;
            productiveSitesList.appendChild(li);
        });

        document.querySelectorAll("button[data-remove-productive]").forEach((btn) => {
            btn.onclick = () => removeProductiveSite(Number(btn.dataset.removeProductive));
        });

        defaultProductiveSelect.innerHTML = "";
        productiveSites.forEach((site) => {
            const option = document.createElement("option");
            option.value = site;
            option.textContent = site;
            option.selected = site === defaultProductiveSite;
            defaultProductiveSelect.appendChild(option);
        });

        mappingList.innerHTML = "";

        blockedSites.forEach((blockedSite) => {
            const li = document.createElement("li");

            const selected = ensureUrl(siteMappings[blockedSite] || "");
            const options = ["<option value=\"\">Use fallback</option>"];

            productiveSites.forEach((site) => {
                const isSelected = site === selected ? "selected" : "";
                options.push(`<option value=\"${site}\" ${isSelected}>${site}</option>`);
            });

            li.innerHTML = `
                <span><b>${blockedSite}</b></span>
                <select data-map-blocked="${blockedSite}">${options.join("")}</select>
            `;

            mappingList.appendChild(li);
        });

        document.querySelectorAll("select[data-map-blocked]").forEach((select) => {
            select.onchange = () => {
                saveMapping(select.dataset.mapBlocked, select.value);
            };
        });

        focusToggle.checked = data.focusMode ?? true;
        randomToggle.checked = data.randomMode ?? true;
        punishToggle.checked = data.punishmentMode ?? false;
        timerToggle.checked = data.timerMode ?? false;
        punishThresholdInput.value = data.punishThreshold || 5;

        const sessionConfig = {
            workMinutes: Number(data.sessionConfig?.workMinutes) || DEFAULT_SESSION_CONFIG.workMinutes,
            breakMinutes: Number(data.sessionConfig?.breakMinutes) || DEFAULT_SESSION_CONFIG.breakMinutes
        };

        const sessionState = resolveSessionState(data.sessionState, sessionConfig);

        if (JSON.stringify(sessionState) !== JSON.stringify(data.sessionState)) {
            chrome.storage.sync.set({ sessionState });
        }

        workMinutesInput.value = sessionConfig.workMinutes;
        breakMinutesInput.value = sessionConfig.breakMinutes;

        if (!sessionState.isActive) {
            sessionStatus.textContent = "Session is not active.";
        } else {
            const timeLeft = formatTimeLeft(sessionState.endsAt - Date.now());
            sessionStatus.textContent = `${sessionState.phase.toUpperCase()} phase - ${timeLeft} remaining`;
        }

    });

}

function addBlockedSite() {

    const blockedSite = normalizeHost(blockedSiteInput.value);

    if (!blockedSite) return;

    chrome.storage.sync.get(["blockedSites"], (data) => {
        const blockedSites = data.blockedSites || [];

        if (!blockedSites.includes(blockedSite)) {
            blockedSites.push(blockedSite);
        }

        chrome.storage.sync.set({ blockedSites }, () => {
            blockedSiteInput.value = "";
            renderState();
        });
    });

}

function addProductiveSite() {

    const productiveSite = ensureUrl(productiveSiteInput.value);

    if (!productiveSite) return;

    chrome.storage.sync.get(["productiveSites", "defaultProductiveSite"], (data) => {
        const productiveSites = (data.productiveSites || DEFAULT_PRODUCTIVE_SITES).map(ensureUrl).filter(Boolean);

        if (!productiveSites.includes(productiveSite)) {
            productiveSites.push(productiveSite);
        }

        chrome.storage.sync.set({
            productiveSites,
            defaultProductiveSite: data.defaultProductiveSite || productiveSites[0]
        }, () => {
            productiveSiteInput.value = "";
            renderState();
        });
    });

}

function removeBlockedSite(index) {

    chrome.storage.sync.get(["blockedSites", "siteMappings"], (data) => {
        const blockedSites = data.blockedSites || [];
        const siteMappings = data.siteMappings || {};

        const [removed] = blockedSites.splice(index, 1);

        if (removed) {
            delete siteMappings[removed];
        }

        chrome.storage.sync.set({ blockedSites, siteMappings }, renderState);
    });

}

function removeProductiveSite(index) {

    chrome.storage.sync.get([
        "productiveSites",
        "siteMappings",
        "defaultProductiveSite"
    ], (data) => {
        const productiveSites = (data.productiveSites || DEFAULT_PRODUCTIVE_SITES).map(ensureUrl).filter(Boolean);
        const siteMappings = data.siteMappings || {};
        const [removed] = productiveSites.splice(index, 1);

        if (!removed) return;

        for (const blockedSite of Object.keys(siteMappings)) {
            if (ensureUrl(siteMappings[blockedSite]) === removed) {
                delete siteMappings[blockedSite];
            }
        }

        const nextDefault = ensureUrl(data.defaultProductiveSite) === removed
            ? (productiveSites[0] || DEFAULT_PRODUCTIVE_SITES[0])
            : ensureUrl(data.defaultProductiveSite) || productiveSites[0] || DEFAULT_PRODUCTIVE_SITES[0];

        chrome.storage.sync.set({
            productiveSites,
            siteMappings,
            defaultProductiveSite: nextDefault
        }, renderState);
    });

}

function saveMapping(blockedSite, productiveSite) {

    chrome.storage.sync.get(["siteMappings"], (data) => {
        const siteMappings = data.siteMappings || {};

        if (!productiveSite) {
            delete siteMappings[blockedSite];
        } else {
            siteMappings[blockedSite] = ensureUrl(productiveSite);
        }

        chrome.storage.sync.set({ siteMappings });
    });

}

function saveDefaultProductive() {

    const url = ensureUrl(defaultProductiveSelect.value);

    if (!url) return;

    chrome.storage.sync.set({ defaultProductiveSite: url });

}

function saveThreshold() {

    const threshold = Math.max(1, Number(punishThresholdInput.value) || 5);
    chrome.storage.sync.set({ punishThreshold: threshold }, renderState);

}

function saveSessionConfig() {

    const workMinutes = Math.max(1, Number(workMinutesInput.value) || DEFAULT_SESSION_CONFIG.workMinutes);
    const breakMinutes = Math.max(1, Number(breakMinutesInput.value) || DEFAULT_SESSION_CONFIG.breakMinutes);

    chrome.storage.sync.set({ sessionConfig: { workMinutes, breakMinutes } }, renderState);

}

function startSession() {

    chrome.storage.sync.get(["sessionConfig"], (data) => {
        const workMinutes = Math.max(1, Number(data.sessionConfig?.workMinutes) || DEFAULT_SESSION_CONFIG.workMinutes);
        const now = Date.now();

        chrome.storage.sync.set({
            sessionState: {
                isActive: true,
                phase: "work",
                startedAt: now,
                endsAt: now + workMinutes * 60 * 1000
            }
        }, renderState);
    });

}

function stopSession() {

    chrome.storage.sync.set({
        sessionState: {
            isActive: false,
            phase: "work",
            startedAt: 0,
            endsAt: 0
        }
    }, renderState);

}

addBlockedBtn.onclick = addBlockedSite;
addProductiveBtn.onclick = addProductiveSite;
saveDefaultBtn.onclick = saveDefaultProductive;
saveThresholdBtn.onclick = saveThreshold;
saveSessionConfigBtn.onclick = saveSessionConfig;
startSessionBtn.onclick = startSession;
stopSessionBtn.onclick = stopSession;

focusToggle.onchange = () => chrome.storage.sync.set({ focusMode: focusToggle.checked });
randomToggle.onchange = () => chrome.storage.sync.set({ randomMode: randomToggle.checked });
punishToggle.onchange = () => chrome.storage.sync.set({ punishmentMode: punishToggle.checked });
timerToggle.onchange = () => chrome.storage.sync.set({ timerMode: timerToggle.checked });

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") return;
    if (Object.keys(changes).length > 0) {
        renderState();
        loadStats();
    }
});

migrateLegacyRules(() => {
    renderState();
    loadStats();
});

setInterval(renderState, 1000);