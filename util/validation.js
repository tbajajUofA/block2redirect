/**
 * SHARED VALIDATION FUNCTIONS
 * 
 * Network and input validation used by popup and settings.
 */

/** Probe network to see if site is reachable (best-effort, 4.5s timeout) */
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
