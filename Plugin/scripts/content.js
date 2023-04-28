// Debug
const debug = 'color: #cd70f4; font-weight: bold;';
const header = 'color: #aceb2f; font-weight: bold; font-size: 25;';
let timeout = null;

// Splits content in message based on new lines and full stops
function splitMessageIntoSentences(message) {
    return message
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .split(/\n|\./)
        .filter((n) => n)
        .map((n) => n.trim());
}

// API call to sentiment analysis API
async function fetchSentimentFromApi(text) {
    let response = await fetch(config.sentimentApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text }),
    });
    if (response.ok) {
        const sentimentPerSentence = {};
        const data = await response.json();
        console.log('API response:', data);
        if ('body' in data) {
            for (let [sentence, sentiment] of Object.entries(data['body'])) {
                // Add the result, e.g. {sentence blah: -1, ...}
                sentimentPerSentence[sentence.toLowerCase().trim()] = sentiment;
            }
        } else {
            throw new Error("The sentiment analysis API didn't return the expected result");
        }
        return sentimentPerSentence;
    } else {
        console.error('Response not OK:', response);
        throw new Error('The sentiment analysis API returned an error when processing the text');
    }
}

function getReplacementOperations(el) {
    const allTextNodes = [];
    if (el.nodeName == '#text') {
        // Fot text nodes we'll create sub-nodes
        const fullLine = el.textContent;
        let inputSentences = splitMessageIntoSentences(fullLine);
        inputSentences = [...new Set(inputSentences)]; // Unique (to avoid replace issues)
        // Replace individual sentences in a multi-sentence line with
        // spans containing each sentence (class=snt-sen)
        for (let i = 0; i < inputSentences.length; i++) {
            if (el.parentNode && el.parentNode.innerHTML) {
                if (el.parentNode.classList.contains('snt-sen')) {
                    // If the parent is already a sentiment sentence, use that instead of adding a new child
                    allTextNodes.push({
                        container: el.parentNode,
                        parent: el.parentNode.parentNode,
                        inputSentence: inputSentences[i],
                        replace: false,
                        hash: md5(inputSentences[i]),
                    });
                    console.log(' *', inputSentences[i], el.parentNode);
                } else {
                    // Create a new span for each sentence in the line
                    const childSpan = document.createElement('SPAN');
                    childSpan.classList.add('snt-sen');
                    childSpan.textContent = inputSentences[i];
                    allTextNodes.push({
                        container: childSpan,
                        parent: el.parentNode,
                        inputSentence: inputSentences[i],
                        replace: true,
                        hash: md5(inputSentences[i]),
                    });
                    console.log(' +', inputSentences[i], childSpan);
                }
            }
        }
    } else {
        // For other HTML elements, recursively search in the children until we find a text node
        for (let i = 0; i < el.childNodes.length; i++) {
            const childNodesTextArray = getReplacementOperations(el.childNodes[i]);
            allTextNodes.push(...childNodesTextArray);
        }
    }
    return allTextNodes;
}

async function fetchSuggestions(data = {}) {
    const response = await fetch(config.suggestionsApiUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    try {
        return response.json();
    } catch (ex) {
        console.log('Error retrieving suggestions', debug, ex);
        return null;
    }
}

async function doSentimentAnalysis(parent, textbox) {
    // Split text into sentences (innerHTML has actual HTML, we only need text with breaks)
    const inputSentences = splitMessageIntoSentences(textbox.innerText);
    console.log('%cInput sentences', header);
    console.log('%c===============', header);
    console.log(inputSentences);

    const outerContainer = parent.closest('.AD').querySelector('.M9');
    const processButton = outerContainer.querySelector('.snt-btn');
    const statusDiv = outerContainer.querySelector('.snt-sts');
    if (processButton != null && statusDiv != null) {
        console.log('%c* Adding loader to button', debug);
        processButton.classList.add('thinking');
        processButton.classList.remove('ready');
    } else {
        console.log('%c* ERROR locating Panda elements (btn, status, ...)', debug);
        return;
    }
    statusDiv.innerHTML = 'Analysing...';

    // Get the sentiment analysis for each unique sentence {'sentence blah': -1}
    let sentimentPerSentence = null;
    try {
        sentimentPerSentence = await fetchSentimentFromApi([...new Set(inputSentences)].join('.'));
    } catch (error) {
        statusDiv.innerHTML = 'Error retrieving sentiment';
        console.log('%cError retrieving sentiment analysis:', debug);
        console.error(error);
        processButton.classList.remove('thinking');
        processButton.classList.add('ready');
        return;
    }

    console.log('%cUnique sentiment per sentence', header);
    console.log('%c=============================', header);
    console.log(sentimentPerSentence);

    // Get the average over the whole text
    function arrayAvg(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    const allValues = [];
    for (const [sentence, value] of Object.entries(sentimentPerSentence)) {
        allValues.push(value);
    }
    const totalScore = arrayAvg(allValues); // from -1 to 1, for example: -0.021
    const scoreSpan = createScoreElement(totalScore);
    statusDiv.innerHTML = '<b>Average Sentiment:</b> ';
    statusDiv.appendChild(scoreSpan);

    // Convert spell-checker incorrect spans back into text
    // as otherwise we can't get the full sentences (interrupted by spans!)
    const incorrectSpans = textbox.querySelectorAll('.Lm.ng');
    for (const item of incorrectSpans) {
        if (item.parentNode && item.parentNode.innerText.length > 0) {
            item.parentNode.innerText = item.parentNode.innerText.replace(item.outerHTML, item.textContent);
        }
    }

    // Go through the text and check if the text has a sentiment analysis result for it
    console.log('%cText Analysis Loop', header);
    console.log('%c==================', header);
    const textNodes = getReplacementOperations(textbox);

    // Assign the sentiment classes to the text nodes
    for (const item of textNodes) {
        const inputSentenceClean = item.inputSentence.trim().toLowerCase();
        if (inputSentenceClean in sentimentPerSentence) {
            item.container.classList.remove('snt-neg', 'snt-neu', 'snt-pos');
            if (sentimentPerSentence[inputSentenceClean] < 0) {
                item.container.classList.add('snt-neg');
                item.container.dataset.hash = item.hash;
                fetchSuggestions({ prompt: inputSentenceClean }).then((data) => {
                    let replacement = data['message'];
                    if (replacement[replacement.length - 1] === '.') {
                        // Remove trailing dot
                        replacement = replacement.slice(0, -1);
                    }
                    if (
                        !replacement.startsWith("I'm sorry, but I can't") &&
                        !replacement.startsWith("I'm sorry, but I cannot")
                    ) {
                        const fixButton = document.createElement('button');
                        fixButton.classList.add('snt-fix');
                        fixButton.title = 'Replace with ' + replacement;
                        fixButton.addEventListener(
                            'click',
                            (e) => {
                                console.log('x', e.target.parentNode);
                                e.target.closest('.snt-sen').classList.remove('snt-neg', 'snt-neu', 'snt-pos');
                                e.target.parentNode.innerText = replacement;
                            },
                            true
                        );
                        const sameSentences = item.parent.querySelectorAll(`span[data-hash="${item.hash}"]`);
                        for (let i = 0; i < sameSentences.length; i++) {
                            // TODO: If not exists
                            sameSentences[i].appendChild(fixButton);
                        }
                        //console.log(sameSentences);
                        //item.container.appendChild(fixButton);
                    }
                    console.log('replacement', inputSentenceClean, replacement, item.container);
                });
            } else if (sentimentPerSentence[inputSentenceClean] == 0) {
                item.container.classList.add('snt-neu');
            } else {
                item.container.classList.add('snt-pos');
            }
            item.container.classList.add('snt-an');
        } else {
            // Don't replace a sentence if it has no match
            item.replace = false;
        }
    }

    console.log('%cAll text in nodes', header);
    console.log('%c=================', header);
    console.log(textNodes);

    function replaceGlobally(original, searchTxt, replaceTxt) {
        const regex = new RegExp(searchTxt, 'g');
        return original.replace(regex, replaceTxt);
    }

    function escapeRegExp(text) {
        return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    // First perform replacements for indexes
    for (const item of textNodes) {
        if (item.replace) {
            item.parent.innerHTML = replaceGlobally(
                item.parent.innerHTML,
                escapeRegExp(item.inputSentence),
                item.container.outerHTML
            );
        }
    }

    processButton.classList.remove('thinking');
    processButton.classList.add('ready');
}

function clearSentimentSpans(parent) {
    const items = parent.querySelectorAll('.snt-an');
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('snt-neg', 'snt-neu', 'snt-pos', 'snt-an');
    }
    const fixButtons = parent.querySelectorAll('.snt-fix');
    for (let i = 0; i < fixButtons.length; i++) {
        fixButtons[i].remove();
    }
}

function createScoreElement(result) {
    let score = config.score.neutral;
    if (result < -0.9) {
        score = config.score.bigbad;
    } else if (result >= -0.9 && result < -0.4) {
        score = config.score.bad;
    } else if (result >= -0.4 && result < -0.1) {
        score = config.score.smolbad;
    } else if (result >= 0.1 && result < 0.4) {
        score = config.score.smolgood;
    } else if (result >= -0.4 && result < 0.9) {
        score = config.score.good;
    } else if (result >= 0.9) {
        score = config.score.biggood;
    }

    // Create item to place score in
    const scoreContainer = document.createElement('span');
    scoreContainer.innerText = score.text;
    scoreContainer.style.fontWeight = 'bold';
    scoreContainer.style.color = score.colour;
    return scoreContainer;
}

function addBar(outerContainer, parentTable, textbox) {
    // Find parent container
    const navContainer = outerContainer.querySelector('.M9');
    console.log(navContainer != null ? '%c- Nav found (M9)' : '%c- Nav not found (M9)', debug);

    // Create primary button
    console.log('%c- Creating clear button...', debug);
    const clearButton = document.createElement('div');
    clearButton.classList.add('snt-btn-gen', 'snt-btn-clear');
    clearButton.title = 'Clear formatting';

    const composeTable = outerContainer.querySelector('.iN');
    clearButton.addEventListener(
        'click',
        (e) => {
            clearSentimentSpans(composeTable);
            const statusDiv = outerContainer.querySelector('.snt-sts');
            statusDiv.innerHTML = '<b>TukTukPanda</b> is ready to rock! &nbsp;';
            return false;
        },
        true
    );

    // Create primary button
    console.log('%c- Creating analyse button...', debug);
    const processButton = document.createElement('div');
    processButton.classList.add('snt-btn-gen', 'snt-btn');
    processButton.title = 'Perform a TukTukPanda Analysis';

    processButton.addEventListener(
        'click',
        (e) => {
            if (e.target && e.target.classList.contains('thinking')) {
                return false;
            }
            doSentimentAnalysis(parentTable, textbox);
            return false;
        },
        true
    );

    // Create status box
    const statusBox = document.createElement('div');
    statusBox.classList.add('snt-sts', 'snt-btn-gen');
    statusBox.innerHTML = 'Getting ready...';

    // Create menu bar
    const nav = document.createElement('div');
    nav.classList.add('snt-nav');

    // Add items to nav, and nav to compose email container (top)
    nav.appendChild(statusBox);
    nav.appendChild(clearButton);
    nav.appendChild(processButton);
    navContainer.appendChild(nav);
    console.log('%c- Button added to navbar', debug);
}

// If an element was added in Gmail, try to find the gmail "compose" window
// If we find it, wait for 1 sec (the textbox might be loading) and then listen to changes
window.addEventListener('DOMNodeInserted', function (event) {
    const e = event.target;
    if (
        e &&
        (e.nodeName == 'DIV' || e.nodeName == 'SPAN') &&
        e.classList &&
        (e.classList.contains('gmail_default') || e.parentNode.classList.contains('editable'))
    ) {
        const outerComposeContainer = e.closest('.AD');
        if (outerComposeContainer.querySelector('.snt-btn') != null) {
            // Avoid setup if this compose window is already set up
            return;
        }

        console.log('%cStarting setup for new compose window...', debug);
        const textbox = outerComposeContainer.querySelector('.Am.Al.editable');
        console.log(textbox != null ? '%c- Txt found (Am Al editable)' : '%c- Txt not found (Am Al editable)', debug);
        const parentTable = outerComposeContainer.querySelector('.cf.An');
        console.log(parentTable != null ? '%c- Parent found (cf An)' : '%c- Parent not found (cf An)', debug);

        // Add bar
        console.log('%cAdding menu bar...', debug);
        addBar(outerComposeContainer, parentTable, textbox);
        const statusDiv = outerComposeContainer.querySelector('.snt-sts');
        statusDiv.innerHTML = '<b>TukTukPanda</b> is ready to rock! &nbsp;';
        const processButton = outerComposeContainer.querySelector('.snt-btn');
        processButton.classList.add('ready');

        // Initial analysis
        /*console.log('%cRunning initial sentiment analysis...', debug);
        doSentimentAnalysis(parentTable, textbox);*/

        // Add a listener for changes (debounced to avoid sending after every keypress)
        /*textbox.addEventListener('keyup', function (e2) {
            clearTimeout(timeout);
            timeout = setTimeout(async function () {
                doSentimentAnalysis(parentTable, textbox);
            }, 10000);
        });*/

        // Clear sentiment spans when user is about to send the email
        const composeTable = e.closest('.iN');
        composeTable.querySelector('.aoO').addEventListener('mouseover', () => clearSentimentSpans(composeTable), true);
        composeTable.querySelector('.aoO').addEventListener('focus', () => clearSentimentSpans(composeTable), true);
        console.log('%cFinished setup!', debug);
    }
});

// MD5 hash function(s) for class names to allow being 'stateless' between async functions
function md5cycle(x, k) {
    var a = x[0],
        b = x[1],
        c = x[2],
        d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
}

function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function md51(s) {
    txt = '';
    var n = s.length,
        state = [1732584193, -271733879, -1732584194, 271733878],
        i;
    for (i = 64; i <= s.length; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
    tail[i >> 2] |= 0x80 << (i % 4 << 3);
    if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
}

function md5blk(s) {
    /* I figured global was faster.   */
    var md5blks = [],
        i; /* Andy King said do it this way. */
    for (i = 0; i < 64; i += 4) {
        md5blks[i >> 2] =
            s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
}

var hex_chr = '0123456789abcdef'.split('');

function rhex(n) {
    var s = '',
        j = 0;
    for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
    return s;
}

function hex(x) {
    for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
    return x.join('');
}

function md5(s) {
    return hex(md51(s));
}

function add32(a, b) {
    return (a + b) & 0xffffffff;
}
