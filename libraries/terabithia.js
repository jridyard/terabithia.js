/*
    TERABITHIA
        The bridge between PAGE and CONTENT script contexts.
            No data corruption, >1ms latency, receive context-locked responses in a single asynchronous callback.
                In page context and need a chrome.storage.local variable? Done.
                In content script context and need a react property? No problem.
*/

// ↓↓ CORE ↓↓

// This callback will handle receiving message from the PAGE script context and sending responses back TO the PAGE from CONTENT script context.
var handleCommandFromContent = async (command, body) => {
    switch (command) {
        default:
            console.log(
                yellowSolidBg,
                `${framework}: Handled unexpected command via handleCommandFromContent: `,
                command
            );
            return;
    }
};

// This callback will handle receiving message from the CONTENT script context and sending responses back TO the CONTENT from PAGE script context.
var handleCommandFromPage = async (command, body) => {
    switch (command) {
        case 'writeMeAPoem':
            return "Roses are red, violets are blue, I'm a poem, how about you?";
        default:
            console.log(yellowSolidBg, `${framework}: Handled unexpected command via handleCommandFromPage: `, command);
            return;
    }
};

// ↑↑ CORE  ↑↑

// ↓ VARS ↓ *** (Remember to adjust these when using new implementations of TERABITHIA!) ***
const UNIQUE_IDENTIFIER = 'fogfckbgfcghicnbhlclgnnklcoinhjc';
const TERABITHIA_PATH = 'libraries/terabithia.js';
const localStorageKeysAccessibleForPage = null; // ['test', 'best']; // using default "getStorage" command, you can restrict which keys are accessible to the PAGE script context. Set to NULL if you want to allow access to ALL storage variables.
// ↑ VARS ↑

/*
    Don't look beneath the hood, try to enjoy the abstraction!
*/

const framework = 'TERABITHIA';
const context = isContentScriptContext() ? 'CONTENT' : 'PAGE';
const counterPartContext = context === 'CONTENT' ? 'PAGE' : 'CONTENT';
const BRIDGE_ID = `${UNIQUE_IDENTIFIER}-${context}`;
const COUNTERPART_BRIDGE_ID = `${UNIQUE_IDENTIFIER}-${counterPartContext}`;
const regSolidBg = '\x1b[41m%s\x1b[0m';
const greenSolidBg = '\x1b[42m%s\x1b[0m';
const blueSolidBg = '\x1b[44m%s\x1b[0m';
const yellowSolidBg = '\x1b[43m%s\x1b[0m';
const redText = '\x1b[31m%s\x1b[0m';
const yellowText = '\x1b[33m%s\x1b[0m';
const cyanText = '\x1b[36m%s\x1b[0m';
const magentaText = '\x1b[35m%s\x1b[0m';
const whiteText = '\x1b[37m%s\x1b[0m';
const blackText = '\x1b[30m%s\x1b[0m';
const greenText = '\x1b[32m%s\x1b[0m';
const blueText = '\x1b[34m%s\x1b[0m';

function isContentScriptContext() {
    return typeof chrome !== 'undefined' && typeof chrome.extension !== 'undefined';
}

function injectScript(file, node = 'body') {
    try {
        const target = document.getElementsByTagName(node)[0];
        const script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('src', file);
        target.appendChild(script);
    } catch (err) {
        console.log(regSolidBg, `${framework} Error: `, err);
    }
}

function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
}

function getReactProp(element, prop) {
    const reactProps = getReactProps(element);
    return reactProps[prop];
}

function getReactProps(element) {
    const reactPropKey = getReactPropKey(element);
    const reactProps = element[reactPropKey];
    return reactProps;
}

function getReactPropKey(element) {
    return Object.keys(element).filter((key) => key.startsWith('__reactProps'))[0];
}

async function getElementsReactProps(element) {
    if (!element) {
        console.log(
            '\x1b[31m%s\x1b[0m',
            `${framework}: getElementsReactProps requires an element. The one passed was not found`
        );
        return null;
    }

    const targetId = uuidv4();
    element.setAttribute('data-terabithia-target', targetId);

    const propsRequest = await sendToPage({
        command: 'getReactProps',
        selector: `[data-terabithia-target="${targetId}"]`
    });
    const propsResponse = propsRequest?.response;

    console.log('propsResponse: ', propsResponse);

    if (!propsResponse?.success) {
        console.log('\x1b[31m%s\x1b[0m', 'Error in getElementsReactProps: ', propsResponse?.message);
    }

    element.removeAttribute('data-terabithia-target');

    return propsResponse?.data;
}

async function triggerElementsReactEvent(element, event) {
    if (!element) {
        console.log(
            '\x1b[31m%s\x1b[0m',
            `${framework}: triggerElementsReactEvent requires an element. The one passed was not found`
        );
        return null;
    }

    const targetId = uuidv4();
    element.setAttribute('data-terabithia-target', targetId);

    const eventRequest = await sendToPage({
        command: 'triggerReactEvent',
        selector: `[data-terabithia-target="${targetId}"]`,
        event
    });
    const eventResponse = eventRequest?.response;

    console.log('eventResponse: ', eventResponse);

    if (!eventResponse?.success) {
        console.log('\x1b[31m%s\x1b[0m', 'Error in triggerReactEvent: ', eventResponse?.message);
    }

    element.removeAttribute('data-terabithia-target');

    return eventResponse?.data;
}

async function getStorageVar(key) {
    if (context === 'CONTENT')
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });

    const storageRequest = await sendToContent({ command: 'getStorage', key });
    const storageResponse = storageRequest?.response;
    return storageResponse;
}

// console.log(blueText, `${framework}: Initializing BRIDGE <${BRIDGE_ID}>`);

/*
    Core Scripts
*/

async function sendToCounterpartContext(json, bridgeId = COUNTERPART_BRIDGE_ID) {
    return new Promise((resolve) => {
        if (!json?.command && bridgeId === COUNTERPART_BRIDGE_ID)
            return console.log(regSolidBg, `${framework}: sendToContent requires a COMMAND property passed via JSON.`);

        const senderId = uuidv4();

        json.senderId = senderId;
        json.context = context;

        const eventInfo = {
            detail: json
        };

        const customEvent = new CustomEvent(bridgeId, eventInfo);

        // console.time(`${framework}: sendToCounterpartContext <${bridgeId}>`);

        const handlResponseFromContent = (e) => {
            const details = e.detail;
            window.removeEventListener(senderId, handlResponseFromContent);
            // console.timeEnd(`${framework}: sendToCounterpartContext <${bridgeId}>`);
            resolve(details);
        };

        window.addEventListener(senderId, handlResponseFromContent);
        window.dispatchEvent(customEvent);
    });
}

// These functions do the exact same thing, but are named differently for clarity. Maybe its dumb, I just think it makes it easier to conceptualize.
// Don't get confused by this. You can just use sendToCounterpartContext in both contexts if that makes more sense to you.
// sendToContent --- ONLY meant to be called from PAGE script context
const sendToContent = sendToCounterpartContext;
// sendToPage --- ONLY meant to be called from PAGE script context
const sendToPage = sendToCounterpartContext;

if (context === 'CONTENT') {
    var getChromeExtensionStorage = async (key) => {
        return new Promise((resolve) => {
            if (localStorageKeysAccessibleForPage && !localStorageKeysAccessibleForPage.includes(key)) {
                console.log(
                    redText,
                    `${framework}: getChromeExtensionStorage received a key that was not approved for PAGE access: `,
                    key
                );
                return resolve(null);
            }
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    };

    var contentScriptContextCallback = async (e) => {
        const body = e.detail;
        const command = body?.command;
        const senderId = body?.senderId;

        var response;
        var unexpectedCommand = false;

        switch (command) {
            case 'checkContentListening':
                response = {
                    message: 'TERABITHIA is WORKING. YEARS LONG PROBLEM: SOLVED!'
                };
                break;
            case 'getStorage':
                response = await getChromeExtensionStorage(body.key);
                break;
            default:
                unexpectedCommand = true;
                break;
        }

        if (unexpectedCommand && typeof handleCommandFromPage === 'function') {
            // run custom callback if it exists
            response = await handleCommandFromPage(command, body);
        }

        if (unexpectedCommand && typeof handleCommandFromContent !== 'function') {
            console.log(redText, `${framework}: Received UNKNOWN COMMAND <${command}> from ${COUNTERPART_BRIDGE_ID}.`);
        }

        sendToPage(
            {
                response
            },
            senderId
        );
    };

    window.addEventListener(BRIDGE_ID, contentScriptContextCallback);
}

if (context === 'PAGE') {
    var pageScriptContextCallback = async (e) => {
        const body = e.detail;
        const command = body?.command;
        const senderId = body?.senderId;

        var response;
        var unexpectedCommand = false;

        switch (command) {
            case 'triggerReactEvent':
                console.log('triggerReactEvent: ', body);
                var element = document.querySelector(body.selector);
                var reactProps = element && getReactProps(element);
                var eventHandler = reactProps?.[body.event];
                if (!eventHandler) {
                    var errorMsg;
                    if (!element) errorMsg = `No element found with selector ${body.selector}.`;
                    else if (!reactProps) errorMsg = `No react props found on element with selector ${body.selector}.`;
                    else if (!eventHandler)
                        errorMsg = `No <${body.event}> handler found on element with selector ${body.selector}.`;
                    console.log(redText, errorMsg);
                    response = {
                        success: false,
                        message: errorMsg
                    };
                } else {
                    try {
                        eventHandler(new Event(''));
                        response = {
                            success: true,
                            message: `Successfully triggered ${body.event} on element with selector ${body.selector}.`
                        };
                    } catch (err) {
                        console.log(
                            redText,
                            `${framework}: Error triggering ${body.event} on element with selector ${body.selector}: `,
                            err
                        );
                        response = {
                            success: false,
                            message: err.toString()
                        };
                    }
                }
                break;
            case 'getReactProps':
                console.log('getReactProps: ', body);
                var element = document.querySelector(body.selector);
                if (element) {
                    var reactProps = element && getReactProps(element);
                    // You are not allowed to pass callbacks over the bridge, so we need to filter them out or else we would lose ALL the data
                    var reactPropsNoCallbacks = Object.keys(reactProps)
                        .filter((key) => typeof reactProps[key] !== 'function')
                        .reduce((obj, key) => {
                            obj[key] = reactProps[key];
                            return obj;
                        }, {});
                    response = {
                        success: true,
                        data: reactPropsNoCallbacks
                    };
                } else {
                    response = {
                        success: false,
                        message: `No element found with selector ${body.selector}.`
                    };
                }

                break;
            case 'sayHello':
                response = 'Hello from the PAGE script context!';
                break;
            default:
                unexpectedCommand = true;
                break;
        }

        if (unexpectedCommand && typeof handleCommandFromContent === 'function') {
            // run custom callback if it exists && the command was not a DEFAULT command
            response = await handleCommandFromContent(command, body);
        }

        if (unexpectedCommand && typeof handleCommandFromContent !== 'function') {
            console.log(redText, `${framework}: Received UNKNOWN COMMAND <${command}> from ${COUNTERPART_BRIDGE_ID}.`);
        }

        sendToContent(
            {
                response
            },
            senderId
        );
    };

    window.addEventListener(BRIDGE_ID, pageScriptContextCallback);
}

/*
    / Core Scripts
*/

// console.log(greenText, `${framework}: INITIALIZED BRIDGE <${BRIDGE_ID}>`);

/*
    FOOTER:
    If the context is CONTENT, then once we've initialized our CONTENT listeners, we can inject the script into the page to initialize the PAGE listeners.
    If the context is PAGE, then we can run a check to see if the CONTENT script is listening.
*/
if (context === 'CONTENT') {
    const terabithiaJs = chrome.runtime.getURL(TERABITHIA_PATH);
    injectScript(terabithiaJs);
}

if (context === 'PAGE') {
    /*
        This will be the final step of the script, in page context.
        Now, let's run a check by sending a message to the CONTENT script to see if it's listening.
        If it IS listening, a final log should go off in the CONTENT script.
    */
    sendToContent({
        command: 'checkContentListening'
    }).then(() => {
        console.log(
            `%cTERABITHIA is OPERATIONAL for: ${UNIQUE_IDENTIFIER}`,
            'color: yellow; background-color: blue; padding: 5px; font-weight: 500;'
        );
    });
}
