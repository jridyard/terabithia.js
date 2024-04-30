const extensionId = 'extensionId';
const context = 'PAGE';
const counterpart = context === 'PAGE' ? 'CONTENT' : 'PAGE';
const unique_identifier = `${extensionId}-${context}`;
const counterpart_identifier = `${extensionId}-${counterpart}`;

async function executeInCounterpartContext(json = {}, bridgeId = counterpart_identifier) {
    return new Promise((resolve) => {
        if (!json?.command && bridgeId === counterpart_identifier)
            return {
                success: false,
                message: `executeInCounterpartContext requires a COMMAND property passed via JSON.`
            };

        const uuidv4 = () =>
            ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
                (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
            );

        const senderId = uuidv4();

        json.senderId = senderId;
        json.context = context;

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

var terabithia = {
    executeInCounterpartContext
};

window.addEventListener(unique_identifier, async (e) => {
    const body = e.detail || {};
    const command = body.command;
    const senderId = body.senderId;

    var response = {
        success: false,
        message: `Unexpected command received in ${context} context. Command: ${command}`
    };

    switch (command) {
        case 'checkContext':
            response = {
                success: true,
                message: `Terabithia is working in ${context} context | You sent a message *FROM* ${counterpart} context and received a response accessible via ${context} context, and received the response back *IN* ${counterpart} context.`
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
