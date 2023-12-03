<h1 align="center">
  <img alt="cgapp logo" src="https://i.imgur.com/mnmnMvu.png" width="65px"/><br/>
  Terabithia.JS
</h1>
<p align="center">
    The bridge between PAGE and CONTENT script contexts.
    </br>
    No data corruption, sub-1ms latency, receive context-locked responses in a single asynchronous callback.
</p>

## ⚡️ Installation

Download the `libraries` folder from this repo and add it to your project.

Add Terabithia as a content script in your manifest using `libraries/terabithia.js`

Make sure to add `libraries/*` to `web_accessible_resources` so Terabithia can inject the bridge into the page.

Lastly, open `terabithia.js` and take a QUICK read through! You may want to adjust the variables and set up your own custom handlers!