/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */
const TERABITHIA = 'terabithia-bridge';
/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */

// Q: What is this "commands" object for?
// A: When you run "window['terabithia-bridge'].execute({ command })" it will look for a callback with that command name in the object below.

// Q: Why don't these overwrite each other? Both page/content context are setting the window variable to the same key.
// A: The window varibles in global context vs. isolated context are seperate and unique in each context.

// ADJUST "commands" to add custom functionality.
// This initializes PAGE script callbacks for CONTENT script context to access \\
window[TERABITHIA].commands = {
    blah: (data) => {
        // "data" will include any data passed from the content script in the json value passed to the .execute() function.
        console.log('blah in page context...', data);
        return {
            success: true,
            message: 'blah in page context ran.'
        };
    }
};
