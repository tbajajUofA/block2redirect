const blockedSiteInput = document.getElementById("blockedSite");
const addBlockedSiteButton = document.getElementById("addBlockedSite");
const blockedSitesList = document.getElementById("blockedSitesList");

const focusToggle = document.getElementById("focusToggle");
const randomToggle = document.getElementById("randomToggle");
const punishToggle = document.getElementById("punishToggle");
const timerToggle = document.getElementById("timerToggle");

function normalizeHost(value) {

    if (!value) return "";

    let host = value.trim().toLowerCase();

    host = host.replace(/^https?:\/\//, "");
    host = host.replace(/^www\./, "");
    host = host.split("/")[0];

    return host;

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
            defaultProductiveSite: data.defaultProductiveSite || productiveSites[0] || "https://leetcode.com/problemset/",
            sessionConfig: data.sessionConfig || { workMinutes: 25, breakMinutes: 5 },
            sessionState: data.sessionState || { isActive: false, phase: "work", startedAt: 0, endsAt: 0 },
            timerMode: data.timerMode ?? false
        }, callback);
    });

}

function loadBlockedSites() {

    chrome.storage.sync.get(["blockedSites"], (data) => {

        const blockedSites = data.blockedSites || [];

        blockedSitesList.innerHTML = "";

        blockedSites.forEach((site, index) => {

            const li = document.createElement("li");

            li.innerHTML = `
                <span><b>${site}</b></span>
                <button data-index="${index}">X</button>
            `;

            blockedSitesList.appendChild(li);

        });

        document.querySelectorAll("button[data-index]").forEach((btn) => {
            btn.onclick = () => removeBlockedSite(Number(btn.dataset.index));
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

        chrome.storage.sync.set({ blockedSites, siteMappings }, loadBlockedSites);

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
            loadBlockedSites();
        });

    });

}

addBlockedSiteButton.onclick = addBlockedSite;

blockedSiteInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        addBlockedSite();
    }

});

document.getElementById("dashboard").onclick = () => {

    chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard/dashboard.html")
    });

};

chrome.storage.sync.get([
    "focusMode",
    "randomMode",
    "punishmentMode",
    "timerMode"
], (data) => {

    focusToggle.checked = data.focusMode ?? true;
    randomToggle.checked = data.randomMode ?? true;
    punishToggle.checked = data.punishmentMode ?? false;
    timerToggle.checked = data.timerMode ?? false;

});

focusToggle.onchange = () => chrome.storage.sync.set({ focusMode: focusToggle.checked });
randomToggle.onchange = () => chrome.storage.sync.set({ randomMode: randomToggle.checked });
punishToggle.onchange = () => chrome.storage.sync.set({ punishmentMode: punishToggle.checked });
timerToggle.onchange = () => chrome.storage.sync.set({ timerMode: timerToggle.checked });

migrateLegacyRules(loadBlockedSites);

