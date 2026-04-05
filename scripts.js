const terminalHistory = document.getElementById('terminal-history');
const typewriterElement = document.getElementById('typewriter');
const promptDir = document.getElementById('prompt-dir');
const terminalViewport = document.getElementById('terminal-viewport');

const sidebarItems = document.querySelectorAll('.sidebar .folder, .sidebar .file');

// ==========================================
// CYBER AUDIO ENGINE
// ==========================================
class CyberAudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.ambientOsc = null;
        this.ambientGain = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.startAmbientHum();
    }

    toggle() {
        if (!this.ctx) this.init();
        if (this.enabled) {
            this.ctx.suspend();
            this.enabled = false;
        } else {
            this.ctx.resume();
            this.enabled = true;
        }
        return this.enabled;
    }

    playTyping() {
        if (!this.enabled || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.02; // very short 20ms click
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    playBeep() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    startAmbientHum() {
        if (!this.ctx) return;
        this.ambientOsc = this.ctx.createOscillator();
        this.ambientOsc.type = 'sawtooth';
        this.ambientOsc.frequency.value = 55;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.015; // ultra quiet background hum

        this.ambientOsc.connect(filter);
        filter.connect(this.ambientGain);
        this.ambientGain.connect(this.ctx.destination);
        this.ambientOsc.start();
    }
}
const audioEngine = new CyberAudioEngine();

// UI Bindings
const audioToggleBtn = document.getElementById('audio-toggle');
if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
        const isNowOn = audioEngine.toggle();
        document.getElementById('audio-status').textContent = isNowOn ? "ON" : "OFF";
        document.getElementById('audio-icon').className = isNowOn ? "fas fa-volume-up" : "fas fa-volume-mute";
        audioToggleBtn.style.color = isNowOn ? "var(--success)" : "var(--text-muted)";
    });
}

const telToggleBtn = document.getElementById('tel-toggle');
const telSidebar = document.getElementById('telemetry-sidebar');
if (telToggleBtn && telSidebar) {
    telToggleBtn.addEventListener('click', () => {
        if (telSidebar.classList.contains('open')) {
            telSidebar.style.display = 'none';
            telSidebar.classList.remove('open');
            telToggleBtn.style.color = 'var(--accent-primary)';
        } else {
            telSidebar.style.display = '';
            telSidebar.classList.add('open');
            telToggleBtn.style.color = 'var(--success)';
        }
    });
}

// Mobile Nav Toggle
const mobileNavBtn = document.getElementById('mobile-nav-toggle');
const sidebarEl = document.querySelector('.sidebar');
if (mobileNavBtn && sidebarEl) {
    mobileNavBtn.addEventListener('click', () => {
        sidebarEl.classList.toggle('mobile-open');
    });
}


// Define the chapters that occur sequentially as we scroll
const chapters = [
    { dir: '~/about', cmd: 'cat identity.md', tpl: 'tpl-0', think: ['Resolving user context...', 'Extracting core parameters...'] },
    { dir: '~/skills', cmd: './display_vectors.sh', tpl: 'tpl-1', think: ['Querying language registries...', 'Mapping ML frameworks...'] },
    { dir: '~/projects', cmd: 'ls -al --deployed', tpl: 'tpl-2', think: ['Scanning active repositories...', 'Fetching deployment metrics...'] },
    { dir: '~/experience', cmd: 'cat work_history.log', tpl: 'tpl-3', think: ['Accessing employment logs...', 'Parsing timeline...'] },
    { dir: '~/certifications', cmd: 'fetch --verified', tpl: 'tpl-4', think: ['Checking digital signatures...', 'Validating badges...'] },
    { dir: '~/publications', cmd: 'grep -r "papers"', tpl: 'tpl-5', think: ['Searching global journals...', 'Found 1 matching article.'] },
    { dir: '~/sparkience_ai', cmd: 'git pull origin main', tpl: 'tpl-6', think: ['Connecting to organization...', 'Downloading active modules...'] },
    { dir: '~/misc', cmd: 'cat education.md', tpl: 'tpl-7', think: ['Locating academic transcripts...'] },
    { dir: '~/misc', cmd: 'cat languages.json', tpl: 'tpl-8', think: ['Parsing linguistic capabilities...'] },
    { dir: '~/misc', cmd: 'cat interests.txt', tpl: 'tpl-9', think: ['Compiling behavior vectors...'] },
    { dir: '~/contact', cmd: './establish_connection.sh', tpl: 'tpl-10', think: ['Resolving communication protocols...', 'Opening secure channels...'] }
];

const totalChapters = chapters.length;
let currentChapter = -1;
let isTyping = false;
let typeInterval;
let scrollHintTimeout;

// Ghost text element
const ghostTextElement = document.createElement('span');
ghostTextElement.className = 'ghost-text';
let ghostEl;

// Handle Scroll Event to determine active chapter
window.addEventListener('scroll', () => {
    // We have 1000vh total. So each chapter gets exactly 100vh of scroll space.
    const scrollPos = window.scrollY;
    const windowHeight = window.innerHeight;

    // Calculate fractional progress and snap to chapter index
    let newChapter = Math.floor(scrollPos / windowHeight);

    // Edge case if we pull past max height
    if (newChapter >= totalChapters) newChapter = totalChapters - 1;
    if (newChapter < 0) newChapter = 0;

    if (newChapter !== currentChapter) {
        changeChapter(newChapter);
    }
});

function changeChapter(index) {
    if (isTyping) {
        clearInterval(typeInterval);
        isTyping = false;
    }

    currentChapter = index;

    updateSidebarUI(index);
    renderInstantHistory(index);
    startTypingCommand(index);
}

// Ensure the sidebar styling updates
function updateSidebarUI(index) {
    sidebarItems.forEach(item => item.classList.remove('active'));
    // Find the item matching this index
    const activeItem = document.querySelector(`.sidebar [data-index="${index}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // if it's a file, ensure parent folder is seemingly open
        if (activeItem.classList.contains('file')) {
            activeItem.parentElement.parentElement.classList.add('active');
        }
    }
}

// Automatically jump scroll depth if sidebar item is clicked
sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent bubbling to parent folder if clicking a file
        const index = parseInt(item.getAttribute('data-index'));
        const targetScroll = index * window.innerHeight;
        window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });

        // Hide sidebar automatically on mobile
        if (window.innerWidth <= 800 && sidebarEl) {
            sidebarEl.classList.remove('mobile-open');
        }
    });
});

// Render everything before the current chapter INSTANTLY to simulate history
function renderInstantHistory(targetIndex) {
    terminalHistory.innerHTML = ''; // Wipe clean

    for (let i = 0; i < targetIndex; i++) {
        const c = chapters[i];
        const cmdHTML = `
            <div class="command-line" style="margin-bottom: 10px; margin-top:15px;">
                <span class="prompt"><span class="user">agent@abstractOS</span>:<span class="dir">${c.dir}</span>$</span>
                <span>${c.cmd}</span>
            </div>
        `;
        const outputTemplate = document.getElementById(c.tpl);
        if (outputTemplate) {
            terminalHistory.innerHTML += cmdHTML + outputTemplate.innerHTML;
        }
    }
    scrollToBottom();
}

// Start typing the active command
function startTypingCommand(index) {
    const c = chapters[index];
    typewriterElement.textContent = '';
    promptDir.textContent = c.dir;

    // Hide ghost text
    if (ghostEl) ghostEl.style.opacity = '0';

    isTyping = true;
    let charIndex = 0;

    // Fast typing effect
    typeInterval = setInterval(() => {
        typewriterElement.textContent += c.cmd.charAt(charIndex);
        audioEngine.playTyping(); // Play audio typing sound
        charIndex++;

        if (charIndex >= c.cmd.length) {
            clearInterval(typeInterval);
            isTyping = false;

            // Wait 200ms before "pressing enter" and simulating the Agent Thinking steps
            setTimeout(() => {
                executeThinkingSteps(index, c);
            }, 200);
        }
    }, 30); // Faster typed speed for snappier feel
}

// Simulate Agent Thinking
function executeThinkingSteps(index, c) {
    if (currentChapter !== index) return;

    // Commit the typed command into the history so the active line moves down
    const cmdHTML = `
        <div class="command-line" style="margin-bottom: 10px; margin-top:20px;">
            <span class="prompt"><span class="user">agent@abstractOS</span>:<span class="dir">${c.dir}</span>$</span>
            <span>${c.cmd}</span>
        </div>
    `;

    // Clear active prompt
    typewriterElement.textContent = '';
    terminalHistory.insertAdjacentHTML('beforeend', cmdHTML);

    // We append a floating container for the thinking steps
    const thinkId = `think-${Date.now()}`;
    terminalHistory.insertAdjacentHTML('beforeend', `<div id="${thinkId}" style="margin-bottom: 15px; font-style:italic;"></div>`);
    const thinkContainer = document.getElementById(thinkId);

    let stepDelay = 0;

    // Fallback pool of general thinking texts
    const generalPool = [
        "Analyzing user context...", "Extracting parameters...",
        "Establishing secure connection...", "Querying database...",
        "Validating cache...", "Compiling neural pathways...",
        "Executing core rutines..."
    ];

    // Choose randomly how many steps (1 to 3)
    const stepCount = Math.floor(Math.random() * 3) + 1;

    // Build the specific steps for this iteration
    let stepsToRun = [];
    if (c.think && c.think.length > 0) {
        // If chapter defines exactly >= stepCount, take those. Else mix.
        stepsToRun = c.think.slice(0, stepCount);
        while (stepsToRun.length < stepCount) {
            stepsToRun.push(generalPool[Math.floor(Math.random() * generalPool.length)]);
        }
    } else {
        // Randomly pick from general pool
        for (let i = 0; i < stepCount; i++) {
            stepsToRun.push(generalPool[Math.floor(Math.random() * generalPool.length)]);
        }
    }

    stepsToRun.forEach((stepText, i) => {
        setTimeout(() => {
            if (currentChapter !== index) return; // abort if scrolled away
            // Add a spinner for the active step
            const stepEl = document.createElement('div');
            stepEl.className = 'sys-out';
            stepEl.innerHTML = `<i class="fas fa-spinner"></i> ${stepText}`;
            thinkContainer.appendChild(stepEl);
            scrollToBottom();

            // If it's not the last step, we change the spinner to a checkmark after it "completes"
            setTimeout(() => {
                if (stepEl && currentChapter === index) {
                    stepEl.innerHTML = `<i class="fas fa-check" style="color:var(--success); margin-right:8px;"></i> ${stepText}`;
                    audioEngine.playBeep(); // Beep on completion
                }
            }, 400); // simulate the step finishing

        }, stepDelay);
        stepDelay += 500; // wait 500ms before starting next step
    });

    // After all thinking is done, dump the actual template
    setTimeout(() => {
        if (currentChapter !== index) return;
        executeCommandFinal(index);
    }, stepDelay + 200);
}

function executeCommandFinal(index) {
    if (currentChapter !== index) return;

    const c = chapters[index];
    const outputTemplate = document.getElementById(c.tpl);

    if (outputTemplate) {
        // We clone and stagger children for nice animation
        terminalHistory.insertAdjacentHTML('beforeend', outputTemplate.innerHTML);

        // Add staggered animation strictly to the newly added block
        const newBlock = terminalHistory.lastElementChild;
        if (newBlock && newBlock.classList.contains('output-block')) {
            gsap.fromTo(newBlock.children, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "power2.out" });
        }
        
        // Pin header to top gracefully
        const activeCmds = terminalHistory.querySelectorAll('.command-line');
        if (activeCmds.length > 0) {
            const lastCmd = activeCmds[activeCmds.length - 1]; 
            setTimeout(() => {
                lastCmd.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50); 
        } else {
            scrollToBottom();
        }
    }

    // Setup ghost text for NEXT command
    clearTimeout(scrollHintTimeout);
    scrollHintTimeout = setTimeout(() => {
        if (index + 1 < totalChapters) {
            const nextC = chapters[index + 1];
            promptDir.textContent = nextC.dir;
            if (!ghostEl) {
                ghostEl = document.getElementById('ghost-text');
            }
            if (ghostEl) {
                ghostEl.textContent = `[Scroll down to execute: ${nextC.cmd}]`;
                ghostEl.style.opacity = '1';
            }
        }
    }, 800); // Wait almost a second before showing hint
}

function scrollToBottom() {
    // We add a tiny delay for DOM painting
    setTimeout(() => {
        terminalViewport.scrollTo({
            top: terminalViewport.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

// Initial Boot (Force trigger the 0 state if we open the page)
// A tiny delay ensures the CSS and heights are properly loaded before querying
setTimeout(() => {
    const scrollPos = window.scrollY;
    let initialChapter = Math.floor(scrollPos / window.innerHeight);
    if (initialChapter > totalChapters - 1) initialChapter = totalChapters - 1;
    changeChapter(initialChapter);
}, 100);

// ==========================================
// TELEMETRY SIMULATION LOOP
// ==========================================
const cpuBar = document.getElementById('cpu-bar');
const cpuVal = document.getElementById('cpu-val');
const memBar = document.getElementById('mem-bar');
const memVal = document.getElementById('mem-val');
const sysClock = document.getElementById('sys-clock');
const netTx = document.getElementById('net-tx');
const netRx = document.getElementById('net-rx');
const miniLog = document.getElementById('mini-log');

const logMessages = [
    "kernel: allocating memory...",
    "sys: process 424 terminated",
    "net: receiving packets",
    "bash: active user agent",
    "auth: secure session OK",
    "daemon: scanning ports...",
    "kernel: optimizing route",
    "sys: memory dumped"
];

setInterval(() => {
    if (!sysClock) return; // fail safe if elements missing
    // Clock
    const now = new Date();
    sysClock.textContent = now.toISOString().substring(11, 23); // HH:MM:SS.mmm

    // CPU Fluctuate (20% to 90%)
    let currentCpu = Math.random() * 70 + 20;
    cpuBar.style.width = currentCpu + '%';
    cpuVal.textContent = currentCpu.toFixed(1) + '%';
    cpuVal.style.color = currentCpu > 80 ? 'var(--error)' : 'var(--success)';

    // Mem fluctuate slightly (35G to 45G out of 64G)
    let memoryGIGS = Math.random() * 10 + 35;
    memBar.style.width = (memoryGIGS / 64 * 100) + '%';
    memVal.textContent = memoryGIGS.toFixed(1) + 'G Used';

    // Network Tx Rx
    netTx.textContent = Math.floor(Math.random() * 80 + 5);
    netRx.textContent = Math.floor(Math.random() * 200 + 10);

    // Occasionally add to mini-log
    if (Math.random() > 0.7 && miniLog) {
        const logLine = logMessages[Math.floor(Math.random() * logMessages.length)];
        miniLog.innerHTML += `<br>${logLine}`;

        // Count number of <br> tags roughly to prune
        const lines = miniLog.innerHTML.split('<br>');
        if (lines.length > 6) {
            miniLog.innerHTML = lines.slice(lines.length - 6).join('<br>'); // keep last 5 lines
        }
    }
}, 1000);
