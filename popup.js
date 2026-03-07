const blockInput = document.getElementById("block");
const redirectInput = document.getElementById("redirect");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");

const addButton = document.getElementById("addRule");
const rulesList = document.getElementById("rulesList");

function loadRules() {

    chrome.storage.sync.get(["rules"], (data) => {

        const rules = data.rules || [];

        rulesList.innerHTML = "";

        rules.forEach((rule, index) => {

            const li = document.createElement("li");

            li.innerHTML = `
                <div>
                    <b>${rule.block}</b> → ${rule.redirect}
                    <br>
                    <small>${rule.start} - ${rule.end}</small>
                </div>
                <button data-index="${index}">X</button>
            `;

            rulesList.appendChild(li);

        });

        document.querySelectorAll("button[data-index]").forEach(btn => {

            btn.onclick = () => removeRule(btn.dataset.index);

        });

    });

}

function removeRule(index) {

    chrome.storage.sync.get(["rules"], (data) => {

        const rules = data.rules || [];

        rules.splice(index, 1);

        chrome.storage.sync.set({ rules }, loadRules);

    });

}

addButton.onclick = () => {

    const block = blockInput.value.trim();
    const redirect = redirectInput.value.trim();

    const start = startInput.value || "00:00";
    const end = endInput.value || "23:59";

    if (!block || !redirect) return;

    chrome.storage.sync.get(["rules"], (data) => {

        const rules = data.rules || [];

        rules.push({
            block,
            redirect,
            start,
            end
        });

        chrome.storage.sync.set({ rules }, () => {

            blockInput.value = "";
            redirectInput.value = "";

            loadRules();

        });

    });

};

document.getElementById("dashboard").onclick = () => {

    chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard.html")
    });

};
loadRules();

const focusToggle = document.getElementById("focusToggle");
const randomToggle = document.getElementById("randomToggle");
const forceToggle = document.getElementById("forceToggle");
const punishToggle = document.getElementById("punishToggle");
const forceURL = document.getElementById("forceURL");

chrome.storage.sync.get([
    "focusMode",
    "randomMode",
    "forceMode",
    "forceURL",
    "punishmentMode"
], data => {

    focusToggle.checked = data.focusMode ?? true;
    randomToggle.checked = data.randomMode ?? false;
    forceToggle.checked = data.forceMode ?? false;
    punishToggle.checked = data.punishmentMode ?? false;

    if(data.forceURL){
        forceURL.value = data.forceURL;
    }

});

focusToggle.onchange = () =>
chrome.storage.sync.set({focusMode:focusToggle.checked})

randomToggle.onchange = () =>
chrome.storage.sync.set({randomMode:randomToggle.checked})

forceToggle.onchange = () =>
chrome.storage.sync.set({forceMode:forceToggle.checked})

punishToggle.onchange = () =>
chrome.storage.sync.set({punishmentMode:punishToggle.checked})

forceURL.addEventListener("input", () => {
    chrome.storage.sync.set({forceURL: forceURL.value});
});

