const statsList = document.getElementById("statsList");

chrome.storage.local.get(["stats"], (data) => {

    const stats = data.stats || {};

    for (const site in stats) {

        const li = document.createElement("li");

        li.innerHTML = `
            <b>${site}</b>
            <span>${stats[site]} blocks</span>
        `;

        statsList.appendChild(li);

    }

});