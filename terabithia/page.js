/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */
const TERABITHIA = 'terabithia-bridge';
/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */

window[TERABITHIA] = {
    execute: executeInCounterpartContext,
    terabithia: {
        executeInCounterpartContext,
        context: 'PAGE',
        counterpart: 'CONTENT',
        context_identifier: `${TERABITHIA}-PAGE`,
        counterpart_identifier: `${TERABITHIA}-CONTENT`,
        terabithia_extension_id: TERABITHIA
    }
    /*
        command: { commandName: () => {} } // add this in a seperate file to keep this file clean.
    */
};

async function executeInCounterpartContext(json = {}, bridgeId = window[TERABITHIA].terabithia.counterpart_identifier) {
    return new Promise((resolve) => {
        if (!json?.command && bridgeId === window[TERABITHIA].terabithia.counterpart_identifier)
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
