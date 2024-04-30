/* ADJUST "TERABITHIA_EXTENSION_ID" to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */
const TERABITHIA_EXTENSION_ID = 'terabithia-test-extension';
/* ADJUST "TERABITHIA_EXTENSION_ID" to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */

const terabithia = {
    executeInCounterpartContext,
    context: 'CONTENT',
    counterpart: 'PAGE',
    context_identifier: `${TERABITHIA_EXTENSION_ID}-CONTENT`,
    counterpart_identifier: `${TERABITHIA_EXTENSION_ID}-PAGE`
};

async function executeInCounterpartContext(json = {}, bridgeId = terabithia.counterpart_identifier) {
    return new Promise((resolve) => {
        if (!json?.command && bridgeId === terabithia.counterpart_identifier)
            return {
                success: false,
                message: `terabithia.executeInCounterpartContext requires a COMMAND property passed via JSON.`
            };

        const uuidv4 = () =>
            ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
                (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
            );

        const senderId = uuidv4();

        json.senderId = senderId;
        json.context = terabithia.context;

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

window.addEventListener(terabithia.context_identifier, async (e) => {
    const body = e.detail || {};
    const command = body.command;
    const senderId = body.senderId;

    var response = {
        success: false,
        message: `Unexpected command received in ${terabithia.context} context. Command: ${terabithia.command}`
    };

    switch (command) {
        case 'checkContext':
            response = {
                success: true,
                message: `Terabithia is working in ${terabithia.context} context | You sent a message *FROM* ${terabithia.counterpart} context and received a response accessible via ${terabithia.context} context, and received the response back *IN* ${terabithia.counterpart} context.`
            };
            break;
    }

    await executeInCounterpartContext(
        {
            response
        },
        senderId
    );
});

function injectTerabithiaIntoPageContext() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('terabithia/page.js');
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

injectTerabithiaIntoPageContext();
