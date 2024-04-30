/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */
const TERABITHIA = 'terabithia-bridge';
/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */

window[TERABITHIA] = {
    execute: executeInCounterpartContext,
    terabithia: {
        executeInCounterpartContext,
        context: 'CONTENT',
        counterpart: 'PAGE',
        context_identifier: `${TERABITHIA}-CONTENT`,
        counterpart_identifier: `${TERABITHIA}-PAGE`,
        terabithia_extension_id: TERABITHIA
    }
    /*
        command: { commandName: () => {} } // add this in a seperate file to keep this file clean.
    */
};

const uuidv4 = () =>
    ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );

async function executeInCounterpartContext(json = {}, bridgeId = window[TERABITHIA].terabithia.counterpart_identifier) {
    return new Promise((resolve) => {
        if (!json?.command && bridgeId === window[TERABITHIA].terabithia.counterpart_identifier)
            return {
                success: false,
                message: `terabithia.executeInCounterpartContext requires a COMMAND property passed via JSON.`
            };

        const senderId = uuidv4();

        json.senderId = senderId;
        json.context = window[TERABITHIA].terabithia.context;

        const eventInfo = {
            detail: json
        };

        const customEvent = new CustomEvent(bridgeId, eventInfo);

        const handlResponseFromContent = (e) => {
            const details = e.detail || {};
            const response = details.response;
            window.removeEventListener(senderId, handlResponseFromContent);
            resolve(response);
        };

        window.addEventListener(senderId, handlResponseFromContent);
        window.dispatchEvent(customEvent);
    });
}

window.addEventListener(window[TERABITHIA].terabithia.context_identifier, async (e) => {
    const body = e.detail || {};
    const command = body.command;
    const senderId = body.senderId;

    var response = {
        success: false,
        message: `Unexpected command received in ${window[TERABITHIA].terabithia.context} context. Command: ${command}`
    };

    switch (command) {
        case 'checkContext':
            response = {
                success: true,
                message: `Terabithia is working in ${window[TERABITHIA].terabithia.context} context | You sent a message *FROM* ${window[TERABITHIA].terabithia.counterpart} context and received a response accessible via ${window[TERABITHIA].terabithia.context} context, and received the response back *IN* ${window[TERABITHIA].terabithia.counterpart} context.`
            };
            break;
    }

    const commandCallback = window[TERABITHIA].commands?.[command];
    if (commandCallback && typeof commandCallback === 'function') {
        response = await commandCallback();
    } else if (commandCallback && typeof commandCallback !== 'function') {
        response = {
            success: false,
            message: `Command callback for ${command} is not a function.`
        };
    }

    await executeInCounterpartContext(
        {
            response
        },
        senderId
    );
});

/* 
    Helpers for COMMON use cases in CONTENT script context
*/
window[TERABITHIA].helpers = {
    triggerElementsReactEvent: async (element, event) => {
        if (!element)
            return {
                success: false,
                message: 'Element not found.'
            };

        const targetId = uuidv4();

        element.setAttribute('data-terabithia-target', targetId);

        const performEventTriggerInPageContext = await window[TERABITHIA].execute({
            command: 'triggerReactEvent',
            selector: `[data-terabithia-target="${targetId}"]`,
            event
        });
        const { success, message } = performEventTriggerInPageContext;

        element.removeAttribute('data-terabithia-target');

        return {
            success,
            message
        };
    }
};

/*
    There are no default "out-of-the-box" commands for the CONTENT script context to handle FROM PAGE context.
    That is up to you to decide what you want for going this direction.
    One idea is to access chrome.storage.local to get data only accessible in the CONTENT script context, but be careful with that.
*/

function injectTerabithiaIntoPageContext() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('terabithia/page.js');
    script.type = 'module';
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

injectTerabithiaIntoPageContext();
