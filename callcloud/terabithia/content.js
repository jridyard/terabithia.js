/* Note: "TERABITHIA" (Custom ID) will already be set in "terabithia/content.js" since that content script should always be loaded first */
/* ADJUST "PAGE_CONTEXT_SCRIPT_PATH" */
const PAGE_CONTEXT_SCRIPT_PATH = 'callcloud/terabithia/page.js'; // Adjust this to inject the correct page context script commands.
/* ADJUST "PAGE_CONTEXT_SCRIPT_PATH" */

function injectTerabithiaPageCommandsScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(PAGE_CONTEXT_SCRIPT_PATH);
    script.type = 'module';
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

injectTerabithiaPageCommandsScript();

// Q: What is this "commands" object for?
// A: When you run "window['terabithia-bridge'].execute({ command })" it will look for a callback with that command name in the object below.

// ADJUST "commands" to add custom functionality.
// This initializes CONTENT script callbacks for PAGE script context to access \\
window[TERABITHIA].commands = {
    blah: () => {
        console.log('blah in content context...');
        return {
            success: true,
            message: 'blah in content context ran.'
        };
    }
};
