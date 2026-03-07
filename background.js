function isWithinSchedule(start, end) {

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    return minutes >= startMin && minutes <= endMin;
}


const productiveSites = [
    "https://leetcode.com/problemset/",
    "https://github.com/trending",
    "https://developer.mozilla.org",
    "https://www.indeed.com",
    "https://stackoverflow.com"
];


function trackBlock(site) {

    chrome.storage.local.get(["stats"], (data) => {

        const stats = data.stats || {};

        stats[site] = (stats[site] || 0) + 1;

        chrome.storage.local.set({ stats });

    });

}


function trackAttempt(site){

    chrome.storage.local.get(["attempts"], data => {

        const attempts = data.attempts || {};

        attempts[site] = (attempts[site] || 0) + 1;

        chrome.storage.local.set({attempts});

    });

}


function shouldPunish(site, threshold, callback){

    chrome.storage.local.get(["attempts"], data => {

        const attempts = data.attempts || {};

        callback((attempts[site] || 0) >= threshold);

    });

}


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab)=>{

    if(changeInfo.status !== "loading") return;

    if(!tab.url) return;

    chrome.storage.sync.get([
        "focusMode",
        "randomMode",
        "forceMode",
        "forceURL",
        "punishmentMode",
        "punishThreshold",
        "rules"
    ], settings=>{

        if(settings.focusMode === false) return;

        const rules = settings.rules || [];

        for(const rule of rules){

            if(
                new URL(tab.url).hostname.includes(rule.block) &&
                isWithinSchedule(rule.start, rule.end)
            ){

                trackAttempt(rule.block);

                shouldPunish(rule.block, settings.punishThreshold || 5, punish=>{

                    let redirectURL = rule.redirect;

                    if(settings.forceMode && settings.forceURL){
                        redirectURL = settings.forceURL;
                    }

                    else if(settings.randomMode){
                        redirectURL =
                        productiveSites[Math.floor(Math.random()*productiveSites.length)];
                    }

                    if(punish && settings.punishmentMode){
                        redirectURL = "https://leetcode.com/problemset/";
                    }

                    chrome.tabs.update(tabId,{url:redirectURL});

                    trackBlock(rule.block);

                });

                return;

            }

        }

    });

});