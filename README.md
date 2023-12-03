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

```javascript
// You can adjust this callback to handle receiving CUSTOM messages from the PAGE script context. Whatever your return will be sent back to the originating context asnchronously.
var handleCommandFromContent = async (command, body) => {
    switch (command) {
        default:
            return;
    };
};

// You can adjust this callback to handle receiving CUSTOM messages from the CONTENT script context. Whatever your return will be sent back to the originating context asnchronously.
var handleCommandFromPage = async (command, body) => {
    switch (command) {
        case "writeMeAPoem":
            // If you go into DEV TOOLS and use this command < await sendToContent({ command: "writeMeAPoem" }) > you will get the following response, even though it is stored in CONTENT script context!
            return "Roses are red, violets are blue, Terabithia is cool... Sorry, I usually write code, not poems.";
        default:
            return;
    };
};

// ↓ VARS ↓ *** (Remember to adjust these when using new implementations of TERABITHIA!) ***
const UNIQUE_IDENTIFIER = "SET_THIS_VARIABLE_TO_YOUR_EXTENSION_ID";
const TERABITHIA_PATH = "libraries/terabithia.js"; // If you copy/paste the folder exactly, you can leave this alone.
const localStorageKeysAccessibleForPage = null; // ['test', 'best']; // using default "getStorage" command, you can restrict which keys are accessible to the PAGE script context. Set to NULL if you want to allow access to ALL storage variables.
// ↑ VARS ↑
```