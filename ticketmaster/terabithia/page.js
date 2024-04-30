/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */
const TERABITHIA = 'terabithia-bridge';
/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */

// Q: What is this "commands" object for?
// A: When you run "window['terabithia-bridge'].execute({ command })" it will look for a callback with that command name in the object below.

// ADJUST "commands" to add custom functionality.
// This initializes PAGE script callbacks for CONTENT script context to access \\
window[TERABITHIA].commands = {
    clickSeat: () => {
        console.log('Running clickSeat in page context...');
        
        const seat = document.querySelector('[id="GEYDSORSHIYTS"]');

        console.log('seat:', seat);

        const

        return {
            success: true,
            message: 'Seat was clicked!'
        };
    }
};
