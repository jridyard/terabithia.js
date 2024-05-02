/* ADJUST "TERABITHIA" (Unique ID for your extension) to be the SAME in ALL terabithia files both CONTENT and PAGE scripts MUST share the same ID */
const TERABITHIA = 'sidebar-bridge';
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
        response = await commandCallback(body);
    } else if (commandCallback && typeof commandCallback !== 'function') {
        response = {
            success: false,
            message: `Command callback for ${command} is not a function.`
        };
    } else if (!commandCallback) {
        const defaultCommandCallback = window[TERABITHIA].defaults?.[command];
        if (defaultCommandCallback) {
            response = await defaultCommandCallback(body);
        }
    }

    await executeInCounterpartContext(
        {
            response
        },
        senderId
    );
});

/* 
    Helpers for COMMON use cases in PAGE context
*/
window[TERABITHIA].helpers = {
    getReactKey: (element, reactKey = '__reactProps') => {
        if (!element) return;
        return Object.keys(element).filter((key) => key.startsWith(reactKey))[0];
    },
    getReactProperties: (element, reactKey = '__reactProps') => {
        const reactPropKey = window[TERABITHIA].helpers.getReactKey(element, reactKey);
        const reactProps = element?.[reactPropKey];
        return reactProps;
    }
};

/*
    Default commands available in PAGE context utilizing the helpers above
*/
window[TERABITHIA].defaults = {
    triggerReactEvent: (body) => {
        const selector = body.selector;
        const event = body.event;
        if (!selector)
            return {
                success: false,
                message: 'Could not trigger react event. No selector provided. Your body should include a SELECTOR key.'
            };
        if (!event)
            return {
                success: false,
                message: 'Could not trigger react event. No event provided. Your body should include an EVENT key.'
            };
        const element = document.querySelector(selector);
        if (!element)
            return {
                success: false,
                message: `Could not trigger react event. No element found with selector ${selector}.`
            };
        const reactProps = window[TERABITHIA].helpers.getReactProps(element);
        if (!reactProps)
            return {
                success: false,
                message: `Could not trigger react event. No react props found on element with selector ${selector}.`
            };
        const reactEventHandler = reactProps[event];
        if (!reactEventHandler)
            return {
                success: false,
                message: `Could not trigger react event. No react event handler "${event}" found on element with selector ${selector}.`
            };

        try {
            reactEventHandler(new Event(''));
            return {
                success: true,
                message: `Successfully triggered ${event} on element with selector ${selector}.`
            };
        } catch (err) {
            return {
                success: false,
                message: `Could not trigger react event. ${err.toString()}`
            };
        }
    },
    getReactProperties: (body) => {
        const selector = body.selector;
        const reactKey = body.reactKey;
        if (!selector)
            return {
                success: false,
                message:
                    'Could not get react properties. No selector provided. Your body should include a SELECTOR key.'
            };
        const element = document.querySelector(selector);
        if (!element)
            return {
                success: false,
                message: `Could not get react properties. No element found with selector ${selector}.`
            };
        const reactProps = window[TERABITHIA].helpers.getReactProperties(element, reactKey);
        if (!reactProps)
            return {
                success: false,
                message: `Could not get react properties. No react props found on element with selector ${selector}.`
            };

        // Can't send callbacks back to content script
        const reactPropsNoCallbacks = Object.keys(reactProps)
            .filter((key) => typeof reactProps[key] !== 'function')
            .reduce((obj, key) => {
                obj[key] = reactProps[key];
                return obj;
            }, {});

        if (reactPropsNoCallbacks['children']) {
            const children = reactPropsNoCallbacks['children'];
            if (Array.isArray(children)) {
                reactPropsNoCallbacks['children'] = children.map((child) => {
                    if (child?.props?.children) {
                        return {
                            props: {
                                children: child.props.children
                            }
                        };
                    }
                    return child;
                });
            }
        }

        return {
            success: true,
            data: reactPropsNoCallbacks
        };
    }
};
