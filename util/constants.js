/**
 * SHARED CONSTANTS
 * 
 * Global constants used across popup, settings, and background scripts.
 */

const DEFAULT_FAVICON_FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="12" fill="#0f172a"/>
        <path d="M20 18h24a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H28l-8 8V24a6 6 0 0 1 6-6Z" fill="#22d3ee"/>
    </svg>
`);

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
