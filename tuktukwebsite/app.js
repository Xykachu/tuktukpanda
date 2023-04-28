async function analyze_text(text, table, btnAnalyse) {
    table.innerHTML = ''; // Clear
    let analysis_results = []; // Init empty array
    let response = await fetch('https://2ru8e32i17.execute-api.eu-west-1.amazonaws.com/dev/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text }),
    });
    if (response.ok) {
        const data = await response.json();
        console.log(data['body']);
        for (let [sentence, sentiment] of Object.entries(data['body'])) {
            if (sentiment < 0) {
                sentiment = '🔴';
            } else if (sentiment > 0) {
                sentiment = '🟢';
            } else {
                sentiment = '⚪';
            }
            analysis_results.push([sentence, sentiment]);
        }
    } else {
        console.error('Response not OK:', response);
    }

    // Create a row for each analysis result and add it to the table
    console.log(analysis_results);
    analysis_results.forEach((result) => {
        const row = document.createElement('tr');
        const textCell = document.createElement('td');
        const sentimentCell = document.createElement('td');
        textCell.textContent = result[0];
        sentimentCell.textContent = result[1];
        row.appendChild(textCell);
        row.appendChild(sentimentCell);
        table.appendChild(row);
    });

    btnAnalyse.disabled = false;
}

async function login(name, password) {
    document.querySelector('.errorMsg').innerText = 'Logging in...';
    let response = await fetch('https://2ru8e32i17.execute-api.eu-west-1.amazonaws.com/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ httpMethod: 'POST', name, password }),
    });

    if (response.ok) {
        const data = await response.json();
        console.log(data);
        if ('error' in data) {
            console.error('Login failed: ' + data['error']);
            document.querySelector('.errorMsg').innerText = '⚠️ Incorrect user or password';
        } else if ('errorMessage' in data) {
            console.error('Login failed: ' + data['errorMessage']);
            document.querySelector('.errorMsg').innerText = '⚠️ Username and password must be filled in';
        } else {
            localStorage.setItem('apiKey', data['body']['apiKey']);
            window.location.href = 'analyse-text.html';
        }
    } else {
        console.error('Login failed:', response);
        document.querySelector('.errorMsg').innerText = 'Server error';
    }
}

async function registerUser(name, password, email) {
    document.querySelector('.errorMsg').innerText = 'Registering new account...';
    let response = await fetch('https://2ru8e32i17.execute-api.eu-west-1.amazonaws.com/dev/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ httpMethod: 'POST', name, password, email }),
    });

    if (response.ok) {
        const data = await response.json();
        console.log(data);
        if ('error' in data) {
            console.error('registration failed: ' + data['error']);
            document.querySelector('.errorMsg').innerText = '⚠️ Username already exists';
        } else if ('errorMessage' in data) {
            console.error('registration failed: ' + data['errorMessage']);
            document.querySelector('.errorMsg').innerText =
                '⚠️ One of the fields is incorrectly formatted (empty or invalid)';
        } else {
            localStorage.setItem('apiKey', data['apiKey']);
            window.location.href = 'analyse-text.html';
        }
    } else {
        console.error('registration failed:', response);
        // TODO: Show error message
    }
}

function logout() {
    localStorage.removeItem('apiKey');
    window.location.href = 'index.html';
}

// Build nav
const apiKey = localStorage.getItem('apiKey');
const leftNav = document.querySelector('.navbar-start');
const rightNav = document.querySelector('.navbar-end');
if (leftNav) {
    let menuItem = null;

    menuItem = document.createElement('A');
    menuItem.classList.add('navbar-item');
    menuItem.href = 'https://github.com/Xykachu/tuktukpanda/releases/tag/v0.1.0';
    menuItem.textContent = 'Plugin';
    leftNav.appendChild(menuItem);

    menuItem = document.createElement('A');
    menuItem.classList.add('navbar-item');
    menuItem.href = 'contact.html';
    menuItem.textContent = 'Contact';
    leftNav.appendChild(menuItem);

    if (apiKey) {
        menuItem = document.createElement('A');
        menuItem.classList.add('navbar-item');
        menuItem.href = 'analyse-text.html';
        menuItem.textContent = 'Analyse';
        leftNav.appendChild(menuItem);
    }
}
if (rightNav) {
    let menuItem = null;

    if (apiKey) {
        menuItem = document.createElement('A');
        menuItem.classList.add('navbar-item');
        menuItem.href = '#';
        menuItem.textContent = 'Logout';
        menuItem.id = 'logout';
        rightNav.appendChild(menuItem);
    } else {
        menuItem = document.createElement('A');
        menuItem.classList.add('navbar-item');
        menuItem.href = 'register.html';
        menuItem.id = 'signup';
        menuItem.textContent = 'Sign Up';
        rightNav.appendChild(menuItem);

        menuItem = document.createElement('A');
        menuItem.classList.add('navbar-item');
        menuItem.href = 'login.html';
        menuItem.textContent = 'Login';
        menuItem.id = 'login';
        rightNav.appendChild(menuItem);
    }
}

// Button event handlers

const btnGetStarted = document.querySelector('button a');
if (btnGetStarted) {
    btnGetStarted.addEventListener('click', function (event) {
        // Scroll smoothly to the target section
        const target = document.querySelector('#get-started');
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
    });
}

const btnAnalyse = document.getElementById('analyze-btn');
if (btnAnalyse) {
    document.getElementById('analyze-btn').addEventListener('click', function () {
        const table = document.getElementById('analysis-table');
        const textArea = document.getElementById('analyze-texts');
        btnAnalyse.disabled = true;
        analyze_text(textArea.value, table, btnAnalyse);
    });
}

const btnLogin = document.getElementById('login-button');
if (btnLogin) {
    btnLogin.addEventListener('click', function (event) {
        event.preventDefault();
        const name = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;
        login(name, password);
    });
}

const btnRegister = document.getElementById('signup-button');
if (btnRegister) {
    btnRegister.addEventListener('click', function (event) {
        event.preventDefault();
        const name = document.getElementById('signup-user').value;
        const password = document.getElementById('signup-pass').value;
        const email = document.getElementById('signup-mail').value;
        registerUser(name, password, email);
    });
}

const btnLogout = document.getElementById('logout');
if (btnLogout) {
    btnLogout.addEventListener('click', function (event) {
        event.preventDefault();
        logout();
    });
}

const loginPwdField = document.getElementById('login-pass');
if (loginPwdField) {
    loginPwdField.addEventListener('keyup', ({ key }) => {
        if (key === 'Enter') {
            const name = document.getElementById('login-user').value;
            const password = document.getElementById('login-pass').value;
            login(name, password);
        }
    });
}

const registerPwdField = document.getElementById('signup-pass');
if (registerPwdField) {
    registerPwdField.addEventListener('keyup', ({ key }) => {
        if (key === 'Enter') {
            const name = document.getElementById('signup-user').value;
            const password = document.getElementById('signup-pass').value;
            const email = document.getElementById('signup-mail').value;
            registerUser(name, password, email);
        }
    });
}
