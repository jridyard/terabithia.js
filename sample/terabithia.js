// ↓↓ CORE ↓↓
// This callback will handle receiving message from the PAGE script context and sending responses back TO the PAGE from CONTENT script context.
// Origin (From): "CONTENT" =>
//    Sends response (To): "PAGE"
//         We are receiving this in "PAGE" !
var handleCommandFromContent = async (command, body) => {
    switch (command) {
        case 'listenForProspectSpeaking':
            listenForProspectSpeaking();
            return true;

        case 'connectProspectAudioForSalesfloor':
            connectProspectAudioForSalesfloor();
            return true;

        case 'setNumberAndCall':
            changeNumberAndCall(body.number);
            return true;

        case 'logCall':
            var logCallResponse = logCallPageContext(body.opts, body.selectors); // { disposition, sentiment, complete }
            return logCallResponse; // { success, message }

        case 'getActiveProspect':
            var prospectDetails = getDialerProspectDetails();
            return {
                success: true,
                data: prospectDetails
            };

        case 'getSidepanelTasks':
            var sidepanelTasks = getSidepanelTasksPageContext(body.selectors);
            return {
                success: true,
                data: sidepanelTasks
            };

        case 'getDialerDetails':
            var dialerDetails = getDialerDetails();
            return {
                success: true,
                data: dialerDetails
            };

        case 'getDialerMutedState':
            var muted = getDialerMutedState();
            return {
                success: true,
                data: {
                    muted
                }
            };

        case 'updateCadenceLimit':
            window.cadenceLimit = body.limit;
            return {
                success: true,
                message: `Updated cadence limit to ${body.limit}`
            };

        case 'triggerReactChangeEvent':
            var phoneNumberElement = document.querySelector(body.selector);
            if (!phoneNumberElement) {
                return {
                    success: false,
                    message: `triggerReactChangeEvent could not find element with selector: ${body.selector}`
                };
            }

            var reactProps = await getReactProps(phoneNumberElement);
            if (!reactProps) {
                return {
                    success: false,
                    message: `triggerReactChangeEvent could not find react props on element with selector: ${body.selector}`
                };
            }

            var onChangeEventHandler = reactProps?.onChange;
            if (!onChangeEventHandler) {
                return {
                    success: false,
                    message: `triggerReactChangeEvent could not find onChange handler on element with selector: ${body.selector}`
                };
            }

            try {
                onChangeEventHandler({
                    target: phoneNumberElement
                });
                return {
                    success: true,
                    message: `Successfully triggered onChange event on element with selector: ${body.selector}`
                };
            } catch (err) {
                return {
                    success: false,
                    message: `Error triggering onChange event on element with selector: ${
                        body.selector
                    }: ${err.toString()}`
                };
            }

        case 'addLogRocket':
            const logRocketMessageType = body.type;
            switch (logRocketMessageType) {
                case 'log':
                    LogRocket.log(body.data);
                    return true;
                case 'info':
                    LogRocket.info(body.data);
                    return true;
                case 'warn':
                    LogRocket.warn(body.data);
                    return true;
                case 'error':
                    LogRocket.error(body.data);
                    return true;
                case 'debug':
                    LogRocket.debug(body.data);
                    return true;
            }
            return true;

        case 'initializeLogRocket':
            initializeLogRocket();
            return true;

        case 'shutdownLogRocket':
            shutdownLogRocket();
            return true;

        default:
            console.log(
                yellowSolidBg,
                `${framework}: Handled unexpected command via handleCommandFromContent: `,
                command
            );
            return;
    }
};

async function listenForProspectSpeaking() {
    const prospectAudio = window.getProspectAudio();
    window.detectSpeakingInProspectMediaStream(prospectAudio).then((res) => {
        // console.log('Did person ever speak: ', res);
        console.log('Ring audio values: ', res.ringtoneAudioValues);
    });
}

// This callback will handle receiving message from the CONTENT script context and sending responses back TO the CONTENT from PAGE script context.
// Origin (From): "PAGE" =>
//    Sends response (To): "CONTENT"
//         We are receiving this in "CONTENT" !
var handleCommandFromPage = async (command, body) => {
    switch (command) {
        case 'callPassthroughInitiated':
            chrome.runtime.sendMessage({
                command: 'callPassthroughInitiated',
                callSid: body.callSid
            });
            return {
                success: true
            };

        case 'getUser':
            var user = await getStorage('user');
            return {
                email: user.email,
                name: user.name
            };

        case 'callLogged':
            addLoggedCallToAPI({
                payload: body.payload,
                response: body.response
            });
            return true;

        case 'sendDiscordNotification':
            sendDiscordNotification(body.opts);
            return true;

        default:
            console.log(yellowSolidBg, `${framework}: Handled unexpected command via handleCommandFromPage: `, command);
            return;
    }
};

// ↑↑ CORE  ↑↑

// AUX
function injectAudio(stream, opts = {}) {
    const audioStreamAlreadyPresent = document.querySelector(`audio[stream-id="${stream.id}"]`);
    if (audioStreamAlreadyPresent) {
        console.warn('Audio stream already present:', audioStreamAlreadyPresent);
        return;
    }

    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.autoplay = opts.autoplay || false;
    if (opts.id) audio.id = opts.id;
    if (opts.muted) audio.muted = true;
    audio.setAttribute('stream-id', stream.id);
    document.body.appendChild(audio);

    // autoplay throws no errors
    // if we play, but never interacted with document, we will get an error
    // helpful for future testing!
    if (opts.play) {
        audio.play();
    }
}

function connectProspectAudioForSalesfloor() {
    const prospectAudio = getProspectAudio(); // STREAM

    if (!prospectAudio) {
        console.log('\x1b[31m%s\x1b[0m', `connectProspectAudioForSalesfloor: No prospect audio found.`);
        return;
    }

    // inject muted audio element with prospectAudio as srcObject and id "prospect-audio" to trigger bindly listener in 'audio/prospect-audio.js'
    if (document.getElementById('prospect-audio')) {
        document.getElementById('prospect-audio').remove();
        return;
    }

    const audio = document.createElement('audio');
    audio.srcObject = prospectAudio;
    audio.id = 'prospect-audio';
    audio.muted = true;
    document.body.appendChild(audio);

    // script continues in 'audio/prospect-audio.js'
}

/**
 * @function logCall
 * @param {Object} opts
 * @params disposition: string, sentiment: string, complete: boolean
 * @description 0ms latency call logging in Salesloft. If complete is true, the task will be marked as complete.
 */
function logCallPageContext(opts = {}, selectors = {}) {
    // const selectors = {
    //     notesArea: '[class*="PopoutCallLogger-styles__Body"] #sl-call-notes-textarea',
    //     popoutLoggerBody: '[class*="PopoutCallLogger-styles__Body"]',
    //     dropdownInputs:
    //         '[class*="PopoutCallLogger-styles__Body"] input[aria-controls^=downshift]'
    // };

    function logOnlyOrLogAndCompleteTask(opts = {}) {
        const fieldsFilled = fillRequiredFields({
            disposition: opts.disposition,
            sentiment: opts.sentiment
        });
        if (!fieldsFilled.success) {
            return {
                success: false,
                message: fieldsFilled.message
            };
        }

        const popoutLoggerOptions = getPopoutLoggerOptions();
        if (opts.complete) {
            /* logCall logs AND completes */
            popoutLoggerOptions.callLoggerActions.logCall();
            return { success: true };
        }

        popoutLoggerOptions.callLoggerActions.logCallLogOnly();
        return { success: true };
    }

    function fillRequiredFields(opts = {}) {
        const getLoggingFieldsContainer = () => {
            const notesArea = document.querySelector(selectors.notesArea);
            /* There are no good selector paths to find the loggingFieldsContainer - the next element sibling after the notes area works though */
            const loggingFieldsContainer = notesArea?.nextElementSibling;
            return loggingFieldsContainer;
        };

        const loggingFieldsContainer = getLoggingFieldsContainer();
        if (!loggingFieldsContainer) {
            /* Some users have reported the dialer/logger disappears when dialing in another tab so this edge case can technically occur */
            return {
                success: false,
                message: 'Could not popout logger selection fields.'
            };
        }

        const loggingFields = getLoggingFieldOptions(loggingFieldsContainer);
        const dispositionField = loggingFields.disposition;
        const sentimentField = loggingFields.sentiment;

        /* 
            I can't explain this one, but roughly 1 in 10 times the value changes on the input BEFORE the react props are updated.
            In these cases, if we rely only on the input value and not the react prop, it will fail to log when we call that function.
            To prevent this, while still ensuring we use the users preferred sentiment/disposition, we'll check the field and set that as their DEFAULT value to set if available
            This way, we set the react prop IMMEDIATELY with the value set in the input field to ensure logging succeeds WITHOUT overriding their input
        */
        // check if field already has value set
        const getInput = (inputType) => {
            // inputType must be "Disposition" or "Sentiment"
            const dropdownItemIndex = inputType === 'Disposition' ? 0 : 1;
            const dropdownInputs = Array.from(document.querySelectorAll(selectors.dropdownInputs));
            const dropdownInput = dropdownInputs[dropdownItemIndex];
            return dropdownInput;
        };
        const dispositionFieldElement = getInput('Disposition');
        const sentimentFieldElement = getInput('Sentiment');
        const dispositionValueSet = dispositionFieldElement?.value;
        const sentimentValueSet = sentimentFieldElement?.value;

        // const checkUserSetOptionAvailable = (userSetOption, options) => {
        //     const userSetOptionAvailable = options.includes(userSetOption);
        //     return userSetOptionAvailable;
        // };
        // const userSetDispositionAvailable = checkUserSetOptionAvailable(
        //     dispositionValueSet || opts.disposition,
        //     dispositionField.fieldNames
        // );
        // const dispositionNameToLog = userSetDispositionAvailable
        //     ? opts.disposition
        //     : dispositionField.mostFrequentField;
        // const userSetSentimentAvailable = checkUserSetOptionAvailable(
        //     sentimentValueSet || opts.sentiment,
        //     sentimentField.fieldNames
        // );
        // const sentimentNameToLog = userSetSentimentAvailable
        //     ? opts.sentiment
        //     : sentimentField.mostFrequentField;

        // check if field already has value set (in react props)
        const dispositionFieldHasValueSetInReact = dispositionField.value;
        const sentimentFieldHasValueSetInReact = sentimentField.value;

        const disposition = dispositionValueSet || opts.disposition;
        const sentiment = sentimentValueSet || opts.sentiment;

        LogRocket.debug('Disposition & Sentiment (User Settings):\n', {
            disposition: opts.disposition,
            sentiment: opts.sentiment
        });
        LogRocket.debug('Disposition & Sentiment (Values To Be Logged):\n', {
            disposition: disposition,
            sentiment: sentiment
        });

        if (!dispositionFieldHasValueSetInReact) {
            LogRocket.info('Disposition (Field Has No React Value Set)');
            if (dispositionField.required) {
                /* If the field is required, it must be logged. */
                dispositionField.onChange({ name: disposition }); // 2/29 prev: dispositionNameToLog
            } else {
                /* If the field is NOT required and user has "-" set, they don't want anything logged for this field */
                if (opts.disposition !== '-') {
                    dispositionField.onChange({ name: disposition }); // 2/29 prev: dispositionNameToLog
                }
            }
        }
        if (!sentimentFieldHasValueSetInReact) {
            LogRocket.info('Sentiment (Field Has No React Value Set)');
            if (sentimentField.required) {
                /* If the field is required, it must be logged. */
                sentimentField.onChange({ name: sentiment }); // 2/29 prev: sentimentNameToLog
            } else {
                /* If the field is NOT required and user has "-" set, they don't want anything logged for this field */
                if (opts.sentiment !== '-') {
                    sentimentField.onChange({ name: sentiment }); // 2/29 prev: sentimentNameToLog
                }
            }
        }

        return {
            success: true,
            message: 'Successfully logged required fields.'
        };
    }

    function getLoggingFieldOptions(loggingFieldsContainer) {
        const loggingFieldProps = getReactFibers(loggingFieldsContainer);
        const loggingFieldMemoizedProps = loggingFieldProps.memoizedProps;
        const memoizedPropsChildren = loggingFieldMemoizedProps.children;

        LogRocket.debug('Container of Disposition & Sentiment (React Props):\n', loggingFieldProps);

        const loggingFieldOptionsOne = memoizedPropsChildren[0].props.children[1].props;
        const loggingFieldOneRequired = memoizedPropsChildren[0].props.hasRequired;
        const loggingFieldOptionsTwo = memoizedPropsChildren[1].props.children[1].props;
        const loggingFieldTwoRequired = memoizedPropsChildren[1].props.hasRequired;

        const getUniqueFieldNameOptions = (
            allOptions = [],
            optionsContainer // added only for logging this insane edge case
        ) => {
            /* "options" (allOptions) prop contains array of objects ("A-Z" and "Frequently Used" which contain sub objects with {id, name}) */
            const uniqueNames = new Set();
            allOptions.forEach((item) => {
                const options = item?.options || [];
                /*
                    Most users have item that looks like this:
                    item = {
                        label: "Frequently Used"
                        options: [{"id": 5779,"name": "No Answer"},{"id": 5782,"name": "Left Voicemail"},{"id": 5780,"name": "Not in Service"}]
                    }

                    ... However, for some reason, some users have item that looks like this:
                    item = {"id": 5779,"name": "No Answer"}

                    *These are the outputs from ITEM as iterated on through allOptions
                    *The obvious key difference being sometimes there is no label property, and then therefore no options property.
                    *To solve for this, if item.options is undefined, we will
                */
                try {
                    if (!item.options) {
                        sendDiscordNotificationFromPageContext({
                            type: 'hypothesis-confirmations',
                            message: `item.options is undefined. The below JSON is the details of "item". There should be a fix for this. Below should be a log confirming the solution.`
                        });
                        sendDiscordNotificationFromPageContext({
                            type: 'hypothesis-confirmations',
                            message: JSON.stringify(item)
                        });
                        // check if object with keys "id" and "name"
                        if (item.id && item.name) {
                            // adds the one off item into the options array so it works the same for this edge case as for the majority of users...
                            options.push(item);
                            sendDiscordNotificationFromPageContext({
                                type: 'hypothesis-confirmations',
                                message: `Item was pushed to options array. Will be included so no issues should occur with the code.`
                            });
                        }
                    }
                } catch (err) {
                    // just in case!!!
                }
                options.forEach((option) => {
                    uniqueNames.add(option?.name);
                });
            });
            try {
                // Never seen this happen. Here just in case something insane happens at some point cause you never know, its salesloft...
                if (allOptions.length === 0) {
                    sendDiscordNotificationFromPageContext({
                        type: 'hypothesis-confirmations',
                        message: `getUniqueFieldNameOptions => error: allOptions.length === 0`
                    });
                    sendDiscordNotificationFromPageContext({
                        type: 'hypothesis-confirmations',
                        message: JSON.stringify(optionsContainer)
                    });
                }
            } catch (err) {
                // just in case!!!
            }
            const uniqueNamesArray = Array.from(uniqueNames);
            return uniqueNamesArray;
        };
        const loggingFieldOneFieldNames = getUniqueFieldNameOptions(
            loggingFieldOptionsOne.options,
            loggingFieldOptionsOne
        );
        const loggingFieldTwoFieldNames = getUniqueFieldNameOptions(
            loggingFieldOptionsTwo.options,
            loggingFieldOptionsOne
        );

        /*
            returns { disposition: props, sentiment: props }
            *PECA Note: "mostFrequentField" can be used as a backup. If the field the user has set is not available for whatever reason, the most likely to be correct field to log is their most used field.
                => Salesloft sets up two "options" arrays. ("Most frequent" first, then "A-Z") The first item in the "Most frequent" array is the most used field and will be at index 0 in our flattened loggingFieldNames array.
        */
        return {
            [loggingFieldOptionsOne.placeholder.toLowerCase()]: {
                ...loggingFieldOptionsOne,
                fieldNames: loggingFieldOneFieldNames,
                mostFrequentField: loggingFieldOneFieldNames[0],
                required: loggingFieldOneRequired
            },
            [loggingFieldOptionsTwo.placeholder.toLowerCase()]: {
                ...loggingFieldOptionsTwo,
                fieldNames: loggingFieldTwoFieldNames,
                mostFrequentField: loggingFieldTwoFieldNames[0],
                required: loggingFieldTwoRequired
            }
        };
    }

    function getPopoutLoggerOptions() {
        const popoutLoggerBody = document.querySelector(selectors.popoutLoggerBody);
        const popoutLoggerProps = getReactFibers(popoutLoggerBody);
        const popoutLoggerMemoizedProps = popoutLoggerProps.memoizedProps;
        const popoutLoggerChildren = popoutLoggerMemoizedProps.children;
        const popoutLoggerOptionsProps = popoutLoggerChildren[1].props;
        return popoutLoggerOptionsProps;
    }

    return logOnlyOrLogAndCompleteTask(opts);
}

// This function is usesless because salesloft somehow does not bother to update their react props when new task cards are loaded in.
// function getSidepanelTasksPageContext(parentSelectors) {
//     const taskSidepanel = document.querySelector(parentSelectors.taskSidepanel);
//     const taskSidepanelProps = getReactProps(taskSidepanel);
//     const targetChildProps = taskSidepanelProps.children.props;
//     const tasks = targetChildProps.tasks;
//     return tasks;
// }

const queryTaskCardsPageContext = (selectors) => {
    // Fuck Salesloft.
    // They mangled all their selectors for the sidepanel tasks and they change on every page refresh
    // Can't use a simple query selector method anymore, now need to run a custom function to query task cards.............
    const callIconsInSidepanel = Array.from(document.querySelectorAll(selectors.sidepanelTaskCallIcon));
    const taskCards = callIconsInSidepanel.map((callIcon) => {
        const taskCardButton = callIcon.closest('button');
        const taskCard = taskCardButton.closest('div');
        return taskCard;
    });
    console.log('query task cards page context: ', taskCards);
    return taskCards;
};

function getSidepanelTasksPageContext(selectors) {
    const sidepanelTasks = queryTaskCardsPageContext(selectors); // Array.from(document.querySelectorAll(selectors.singularTaskCards));
    const tasks = sidepanelTasks.map((task) => {
        const taskData = getTaskCardTaskDataPageContext(task);
        return taskData;
    });
    return tasks;
}

function getTaskCardTaskDataPageContext(taskCardElement) {
    const taskSidepanelProps = getReactProps(taskCardElement);
    const targetChildProps = taskSidepanelProps.children?.[1]?.props?.children?.props;
    const taskData = targetChildProps?.taskData;
    return taskData;
}

function getDialerProspectDetails() {
    /*
        PAGE_CONTEXT ONLY
    */
    function getDialerPersonFiberProps() {
        const dialerElement = document.querySelector('[class*="styles__DialerBox"]');
        const props = getReactFibers(dialerElement);
        return props;
    }

    function getPersonDetailsProp(dialerPersonFiberProps) {
        const personDetailsProp =
            dialerPersonFiberProps.memoizedProps.children[1].props.children[0].props.children.props.callingPerson;
        return personDetailsProp;
    }

    return getPersonDetailsProp(getDialerPersonFiberProps());
}

function getDialerActions() {
    /*
        PAGE_CONTEXT ONLY
    */
    function getDialerPersonFiberProps() {
        const dialerElement = document.querySelector('[class*="styles__DialerBox"]');
        const props = getReactFibers(dialerElement);
        return props;
    }

    function getPersonDetailsProp(dialerPersonFiberProps) {
        const personDetailsProp = dialerPersonFiberProps.memoizedProps.children[0].props.children.props.children.props;
        return personDetailsProp;
    }

    return getPersonDetailsProp(getDialerPersonFiberProps());
}

function getDialerDetails() {
    var dialerDetails = getDialerActions();
    var dialerDetailsNoCallbacks = Object.keys(dialerDetails)
        .filter((key) => typeof dialerDetails[key] !== 'function')
        .reduce((obj, key) => {
            obj[key] = dialerDetails[key];
            return obj;
        }, {});
    return dialerDetailsNoCallbacks;
}

function changeNumberAndCall(number = '') {
    if (!number) {
        console.log('No number passed to changeNumberAndCall');
        return;
    }

    const selectors = {
        dialerContainer: '[class*=styles__DialerBox]'
    };
    const dialerContainer = document.querySelector(selectors.dialerContainer);
    const dialerContainerProps = getReactFibers(dialerContainer);
    const dialerContainerMemoizedProps = dialerContainerProps.memoizedProps;
    const dialerContainerChildren = dialerContainerMemoizedProps.children;

    const targetProps = dialerContainerChildren[1].props.children[0].props.children.props;

    const formActions = targetProps.formActions;
    const setNumber = formActions.setNumber; // pass string to set number input before dialing

    const initiateDial = targetProps.onSubmit;

    setNumber(number);
    initiateDial(number);
}

// / AUX

// ↓ VARS ↓ *** (Remember to adjust these when using new implementations of TERABITHIA!) ***
const UNIQUE_IDENTIFIER = 'salesloft-terabithia';
const TERABITHIA_PATH = 'dialer/salesloft/bridge/terabithia.js';
const localStorageKeysAccessibleForPage = null; // add variables you want accessible from page context...
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

function sendDiscordNotificationFromPageContext(opts = {}) {
    sendToContent({
        command: 'sendDiscordNotification',
        opts
    });
}

function isContentScriptContext() {
    return typeof chrome !== 'undefined' && typeof chrome.extension !== 'undefined';
}

function injectScript(file, type = 'module', node = 'body') {
    try {
        const target = document.getElementsByTagName(node)[0];
        const script = document.createElement('script');
        script.setAttribute('type', type);
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

function getReactFibers(element) {
    const reactPropKey = getReactFiberKey(element);
    const reactProps = element[reactPropKey];
    return reactProps;
}

function getReactFiberKey(element) {
    return Object.keys(element).filter((key) => key.startsWith('__reactFiber'))[0];
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

    if (!eventResponse?.success) {
        console.log('\x1b[31m%s\x1b[0m', 'Error in triggerReactEvent: ', eventResponse?.message);
    }

    element.removeAttribute('data-terabithia-target');

    return eventResponse?.data;
}

async function triggerReactChangeEvent(selector) {
    /* CONTENT script context */
    const outcome = await sendToPage({
        command: 'triggerReactChangeEvent',
        selector
    });
    return outcome;
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
                    message: 'TERABITHIA is WORKING.'
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
    injectScript(terabithiaJs, 'text/javascript');

    const auxScriptUrl = 'dialer/salesloft/bridge/page/call-logged-to-salesloft-api-interceptor.js';
    const auxScript = chrome.runtime.getURL(auxScriptUrl);
    injectScript(auxScript, 'text/javascript');

    const auxScriptTwo = chrome.runtime.getURL('dialer/salesloft/bridge/page/call-pass-through.js');
    injectScript(auxScriptTwo, 'text/javascript');

    // Realtime transcription / audio intercept for salesfloor
    const auxScriptThree = chrome.runtime.getURL('dialer/audio-and-transcription.js');
    injectScript(auxScriptThree);

    // Audio capture / sample for speaking detection
    // const auxScriptFour = chrome.runtime.getURL('dialer/audio-prospect-speaking-detection.js');
    // injectScript(auxScriptFour);
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

    /* This is used to set the window context variable for custom/task-limiter to access without needing an async await that would break the interceptor */
    getStorageVar('cadenceLimit').then((limit) => {
        window.cadenceLimit = limit;
    });
}
