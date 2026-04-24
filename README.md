# block2redirect

A Chrome extension that redirects distracting websites to productive ones.

Example:
- Reddit → LeetCode
- YouTube → Indeed
- Twitter → GitHub

## Features

- Custom website blocking
- Custom redirect targets
- Time-based blocking schedules
- Productivity statistics
- Lightweight (no tracking, no analytics)

## Example Rules
-reddit.com → https://leetcode.com
- youtube.com → https://indeed.com


## Installation (Developer Mode)

1. Clone the repository


2. Open Chrome
chrome://extensions


3. Enable **Developer Mode**

4. Click **Load Unpacked**

5. Select the project folder

## How It Works

The extension listens for tab updates and checks the URL against user-defined rules stored in Chrome storage.

If a rule matches, the tab is redirected to the specified productive site.

## Privacy

This extension:

- Stores all settings locally in your browser
- Does not collect data
- Does not send any information to external servers

## Tech Stack

- Chrome Extensions API (Manifest V3)
- JavaScript
- HTML/CSS

## License

MIT
