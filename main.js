document.addEventListener('DOMContentLoaded', () => {
    const DOM = {
        fileInput: document.getElementById('file-input'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        skipForwardBtn: document.getElementById('skip-forward-btn'),
        skipBackwardBtn: document.getElementById('skip-backward-btn'),
        progressBar: document.getElementById('progress-bar'),
        currentTimeEl: document.getElementById('current-time'),
        durationEl: document.getElementById('duration'),
        trackTitle: document.getElementById('track-title'),
        trackArtist: document.getElementById('track-artist'),
        albumArt: document.getElementById('album-art'),
        canvas: document.getElementById('visualizer-canvas'),
        settingsBtn: document.getElementById('settings-btn'),
        visualizationBtn: document.getElementById('visualization-btn'),
        settingsMenu: document.getElementById('settings-menu'),
        visualizationMenu: document.getElementById('visualization-menu'),
        menuOverlay: document.getElementById('menu-overlay'),
        closeBtns: document.querySelectorAll('.close-btn'),
        themeSelect: document.getElementById('theme-select'),
        speedSlider: document.getElementById('speed-slider'),
        speedValue: document.getElementById('speed-value'),
        resetSpeedBtn: document.getElementById('reset-speed-btn'),
        pitchSlider: document.getElementById('pitch-slider'),
        pitchValue: document.getElementById('pitch-value'),
        resetPitchBtn: document.getElementById('reset-pitch-btn'),
        vizToggle: document.getElementById('viz-toggle'),
        vizOptionsGroup: document.getElementById('viz-options-group'),
        vizTypeSelect: document.getElementById('viz-type-select'),
        vizThemeSelect: document.getElementById('viz-theme-select'),
        customColorContainer: document.getElementById('custom-color-container'),
        vizColorPicker: document.getElementById('viz-color-picker'),
        vizHexInput: document.getElementById('viz-hex-input'),
        lineCountSlider: document.getElementById('line-count-slider'),
        lineCountValue: document.getElementById('line-count-value'),
        lineCountSetting: document.querySelector('.viz-lines-only'),
        symmetryToggle: document.getElementById('symmetry-toggle'),
        symmetryOptionsGroup: document.getElementById('symmetry-options-group'),
        repeatAmountSlider: document.getElementById('repeat-amount-slider'),
        repeatAmountValue: document.getElementById('repeat-amount-value'),
        mirrorToggle: document.getElementById('mirror-toggle'),
        sensitivitySlider: document.getElementById('sensitivity-slider'),
        sensitivityValue: document.getElementById('sensitivity-value'),
        smoothingSlider: document.getElementById('smoothing-slider'),
        smoothingValue: document.getElementById('smoothing-value'),
    };

    const ctx = DOM.canvas.getContext('2d');
    let audioContext, analyser, source, gainNode, buffer;
    let dataArray, bufferLength;
    let isPlaying = false;
    let startTime = 0;
    let pausedAt = 0;
    let animationFrameId;

    const settings = {
        theme: 'theme-dark',
        speed: 1.0,
        pitch: 0,
        visualization: {
            enabled: true,
            type: 'waveform-lines',
            theme: 'default',
            customColor: '#ffffff',
            lineCount: 64,
            symmetry: {
                enabled: false,
                repeats: 2,
                mirror: false,
            },
            sensitivity: 1.0,
            smoothing: 0.8,
        }
    };

    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            gainNode = audioContext.createGain();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = settings.visualization.smoothing;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }
    }
    
    function loadFile(file) {
        if (audioContext && audioContext.state === 'running') {
            audioContext.close();
            audioContext = null;
        }
        initAudioContext();
        
        const reader = new FileReader();
        reader.onload = (e) => {
            audioContext.decodeAudioData(e.target.result, (decodedBuffer) => {
                buffer = decodedBuffer;
                DOM.durationEl.textContent = formatTime(buffer.duration);
                DOM.progressBar.max = buffer.duration;
                DOM.progressBar.disabled = false;
                playAudio(0);
            }, (error) => console.error('Error decoding audio data', error));
        };
        reader.readAsArrayBuffer(file);
        
        window.jsmediatags.read(file, {
            onSuccess: (tag) => {
                const { title, artist, picture } = tag.tags;
                DOM.trackTitle.textContent = title || file.name.replace(/\.[^/.]+$/, "");
                DOM.trackArtist.textContent = artist || 'Unknown Artist';
                if (picture) {
                    const base64String = btoa(String.fromCharCode.apply(null, picture.data));
                    DOM.albumArt.src = `data:${picture.format};base64,${base64String}`;
                } else {
                    DOM.albumArt.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                }
            },
            onError: () => {
                DOM.trackTitle.textContent = file.name.replace(/\.[^/.]+$/, "");
                DOM.trackArtist.textContent = 'Unknown Artist';
                DOM.albumArt.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            }
        });
    }
    
    function playAudio(offset) {
        if (source) {
            source.stop();
        }
        
        source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = settings.speed;
        source.detune.value = settings.pitch;
        
        source.connect(gainNode).connect(analyser).connect(audioContext.destination);
        source.start(0, offset);
        
        startTime = audioContext.currentTime - offset;
        pausedAt = 0;
        isPlaying = true;
        DOM.playPauseBtn.classList.add('playing');
        
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        visualize();
        updateProgressBar();
    }

    function togglePlayPause() {
        if (!audioContext || !buffer) return;
        if (isPlaying) {
            audioContext.suspend();
            pausedAt = audioContext.currentTime - startTime;
            isPlaying = false;
            DOM.playPauseBtn.classList.remove('playing');
            cancelAnimationFrame(animationFrameId);
        } else {
            audioContext.resume();
            startTime = audioContext.currentTime - pausedAt;
            isPlaying = true;
            DOM.playPauseBtn.classList.add('playing');
            visualize();
            updateProgressBar();
        }
    }

    function skip(seconds) {
        if (!audioContext || !buffer) return;
        const newTime = (audioContext.currentTime - startTime) + seconds;
        const clampedTime = Math.max(0, Math.min(newTime, buffer.duration));
        playAudio(clampedTime);
    }

    function updateProgressBar() {
        if (!isPlaying || !buffer) return;
        const currentTime = audioContext.currentTime - startTime;
        DOM.progressBar.value = currentTime;
        DOM.currentTimeEl.textContent = formatTime(currentTime);
        if (currentTime >= buffer.duration) {
            isPlaying = false;
            DOM.playPauseBtn.classList.remove('playing');
            DOM.progressBar.value = 0;
            DOM.currentTimeEl.textContent = "0:00";
            cancelAnimationFrame(animationFrameId);
        } else {
            requestAnimationFrame(updateProgressBar);
        }
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function resizeCanvas() {
        DOM.canvas.width = window.innerWidth;
        DOM.canvas.height = window.innerHeight;
    }

    function visualize() {
        animationFrameId = requestAnimationFrame(visualize);
        analyser.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

        if (!settings.visualization.enabled) return;

        const repeats = settings.visualization.symmetry.enabled ? settings.visualization.symmetry.repeats : 1;
        
        ctx.save();
        ctx.translate(DOM.canvas.width / 2, DOM.canvas.height / 2);

        for (let i = 0; i < repeats; i++) {
            ctx.save();
            const angle = (Math.PI * 2 / repeats) * i;
            ctx.rotate(angle);
            
            if (settings.visualization.symmetry.enabled && settings.visualization.symmetry.mirror) {
                if (i % 2 !== 0) {
                    ctx.scale(1, -1);
                }
            }
            
            drawVisualizationType();
            ctx.restore();
        }
        ctx.restore();
    }
    
    function drawVisualizationType() {
        switch (settings.visualization.type) {
            case 'waveform-lines': drawWaveformLines(); break;
            case 'waveform-smooth': drawWaveformSmooth(); break;
            case 'circle-smooth-flow': drawCircle(true, false); break;
            case 'circle-smooth-pulse': drawCircle(true, true); break;
            case 'circle-lines-flow': drawCircle(false, false); break;
        }
    }

    function setVizStyle() {
        const theme = settings.visualization.theme;
        if (theme === 'default') {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
        } else if (theme === 'custom') {
            ctx.fillStyle = settings.visualization.customColor;
            ctx.strokeStyle = settings.visualization.customColor;
        } else {
            let gradient;
            if (settings.visualization.type.includes('circle')) {
                gradient = ctx.createRadialGradient(0, 0, 50, 0, 0, DOM.canvas.height / 3);
            } else {
                gradient = ctx.createLinearGradient(0, -DOM.canvas.height / 4, 0, DOM.canvas.height / 4);
            }

            if (theme === 'rainbow') {
                gradient.addColorStop(0, 'red');
                gradient.addColorStop(0.2, 'orange');
                gradient.addColorStop(0.4, 'yellow');
                gradient.addColorStop(0.6, 'green');
                gradient.addColorStop(0.8, 'blue');
                gradient.addColorStop(1, 'purple');
            } else if (theme === 'warmth') {
                gradient.addColorStop(0, '#ff0000');
                gradient.addColorStop(0.5, '#ffa500');
                gradient.addColorStop(1, '#ffff00');
            } else if (theme === 'cooled') {
                gradient.addColorStop(0, '#0000ff');
                gradient.addColorStop(1, '#8a2be2');
            }
            ctx.fillStyle = gradient;
            ctx.strokeStyle = gradient;
        }
    }

    function drawWaveformLines() {
        setVizStyle();
        ctx.lineWidth = 2;
        const lineCount = settings.visualization.lineCount;
        const sliceWidth = (DOM.canvas.width / lineCount);
        let x = -DOM.canvas.width / 2;

        for (let i = 0; i < lineCount; i++) {
            const dataIndex = Math.floor(i * (bufferLength / lineCount));
            const v = dataArray[dataIndex] / 128.0;
            const h = v * (DOM.canvas.height / 3) * settings.visualization.sensitivity;
            
            ctx.beginPath();
            ctx.moveTo(x, -h / 2);
            ctx.lineTo(x, h / 2);
            ctx.stroke();

            x += sliceWidth;
        }
    }
    
    function drawWaveformSmooth() {
        setVizStyle();
        ctx.beginPath();
        const sliceWidth = DOM.canvas.width / bufferLength;
        let x = -DOM.canvas.width / 2;
        
        ctx.moveTo(x, 0);

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * (DOM.canvas.height / 4) * settings.visualization.sensitivity;
            ctx.lineTo(x, y);
            x += sliceWidth;
        }
        
        x = DOM.canvas.width / 2;
        for (let i = bufferLength - 1; i >= 0; i--) {
            const v = dataArray[i] / 128.0;
            const y = v * (DOM.canvas.height / 4) * settings.visualization.sensitivity;
            ctx.lineTo(x, -y);
            x -= sliceWidth;
        }

        ctx.closePath();
        ctx.fill();
    }

    function drawCircle(isSmooth, isPulse) {
        setVizStyle();
        ctx.lineWidth = isSmooth ? 4 : 2;
        const lineCount = settings.visualization.lineCount;
        const pointsToDraw = settings.visualization.type.includes('lines') ? lineCount : bufferLength;

        const maxRadius = DOM.canvas.height / 4;
        let baseRadius = isPulse ? maxRadius / 2 : maxRadius / 3;
        
        if (isPulse) {
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const avg = sum / bufferLength;
            baseRadius = (avg / 128) * (maxRadius / 2) * settings.visualization.sensitivity + maxRadius/4;
        }

        ctx.beginPath();
        for (let i = 0; i <= pointsToDraw; i++) {
            const angle = (i / pointsToDraw) * Math.PI * 2;
            const dataIndex = Math.floor((i / pointsToDraw) * bufferLength) % bufferLength;
            const v = dataArray[dataIndex] / 128.0;
            const r_offset = v * (maxRadius / 2) * settings.visualization.sensitivity;
            const radius = baseRadius + r_offset;
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (isSmooth) {
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            } else {
                const x_outer = Math.cos(angle) * (radius + r_offset / 2);
                const y_outer = Math.sin(angle) * (radius + r_offset / 2);
                ctx.moveTo(x, y);
                ctx.lineTo(x_outer, y_outer);
            }
        }
        
        if (isSmooth) {
            ctx.closePath();
            if (isPulse) ctx.fill(); else ctx.stroke();
        } else {
            ctx.stroke();
        }
    }
    
    function updateUIFromSettings() {
        document.body.className = settings.theme;
        DOM.themeSelect.value = settings.theme;
        DOM.speedSlider.value = settings.speed;
        DOM.speedValue.textContent = Number(settings.speed).toFixed(2);
        DOM.pitchSlider.value = settings.pitch;
        DOM.pitchValue.textContent = settings.pitch;

        DOM.vizToggle.checked = settings.visualization.enabled;
        DOM.vizOptionsGroup.disabled = !settings.visualization.enabled;
        
        DOM.vizTypeSelect.value = settings.visualization.type;
        DOM.vizThemeSelect.value = settings.visualization.theme;
        DOM.customColorContainer.style.display = settings.visualization.theme === 'custom' ? 'flex' : 'none';
        DOM.vizColorPicker.value = settings.visualization.customColor;
        DOM.vizHexInput.value = settings.visualization.customColor;
        
        const isLinesViz = settings.visualization.type.includes('lines');
        DOM.lineCountSetting.style.display = isLinesViz ? 'block' : 'none';
        DOM.lineCountSlider.value = settings.visualization.lineCount;
        DOM.lineCountValue.textContent = settings.visualization.lineCount;
        
        DOM.symmetryToggle.checked = settings.visualization.symmetry.enabled;
        DOM.symmetryOptionsGroup.disabled = !settings.visualization.symmetry.enabled;
        
        DOM.repeatAmountSlider.value = settings.visualization.symmetry.repeats;
        DOM.repeatAmountValue.textContent = settings.visualization.symmetry.repeats;

        const isRepeatsEven = settings.visualization.symmetry.repeats % 2 === 0;
        DOM.mirrorToggle.disabled = !isRepeatsEven;
        if (!isRepeatsEven) {
            DOM.mirrorToggle.checked = false;
            settings.visualization.symmetry.mirror = false;
        }
        DOM.mirrorToggle.checked = settings.visualization.symmetry.mirror;

        DOM.sensitivitySlider.value = settings.visualization.sensitivity;
        DOM.sensitivityValue.textContent = Number(settings.visualization.sensitivity).toFixed(1);
        DOM.smoothingSlider.value = settings.visualization.smoothing;
        DOM.smoothingValue.textContent = Number(settings.visualization.smoothing).toFixed(2);
    }
    
    function setupEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        DOM.fileInput.addEventListener('change', (e) => loadFile(e.target.files[0]));
        DOM.playPauseBtn.addEventListener('click', togglePlayPause);
        DOM.skipForwardBtn.addEventListener('click', () => skip(10));
        DOM.skipBackwardBtn.addEventListener('click', () => skip(-10));
        DOM.progressBar.addEventListener('input', (e) => {
            if(buffer) playAudio(parseFloat(e.target.value));
        });

        DOM.settingsBtn.addEventListener('click', () => { DOM.settingsMenu.classList.add('active'); DOM.menuOverlay.classList.add('active'); });
        DOM.visualizationBtn.addEventListener('click', () => { DOM.visualizationMenu.classList.add('active'); DOM.menuOverlay.classList.add('active'); });
        DOM.menuOverlay.addEventListener('click', () => { DOM.settingsMenu.classList.remove('active'); DOM.visualizationMenu.classList.remove('active'); DOM.menuOverlay.classList.remove('active'); });
        DOM.closeBtns.forEach(btn => btn.addEventListener('click', (e) => { document.getElementById(e.target.dataset.target).classList.remove('active'); DOM.menuOverlay.classList.remove('active'); }));
        
        DOM.themeSelect.addEventListener('change', (e) => { settings.theme = e.target.value; updateUIFromSettings(); });
        DOM.speedSlider.addEventListener('input', (e) => { settings.speed = parseFloat(e.target.value); if(source) source.playbackRate.value = settings.speed; updateUIFromSettings(); });
        DOM.resetSpeedBtn.addEventListener('click', () => { settings.speed = 1.0; if(source) source.playbackRate.value = settings.speed; updateUIFromSettings(); });
        DOM.pitchSlider.addEventListener('input', (e) => { settings.pitch = parseInt(e.target.value); if(source) source.detune.value = settings.pitch; updateUIFromSettings(); });
        DOM.resetPitchBtn.addEventListener('click', () => { settings.pitch = 0; if(source) source.detune.value = settings.pitch; updateUIFromSettings(); });
        
        DOM.vizToggle.addEventListener('change', (e) => { settings.visualization.enabled = e.target.checked; updateUIFromSettings(); });
        DOM.vizTypeSelect.addEventListener('change', (e) => { settings.visualization.type = e.target.value; updateUIFromSettings(); });
        DOM.vizThemeSelect.addEventListener('change', (e) => { settings.visualization.theme = e.target.value; updateUIFromSettings(); });
        DOM.vizColorPicker.addEventListener('input', (e) => { settings.visualization.customColor = e.target.value; updateUIFromSettings(); });
        DOM.vizHexInput.addEventListener('change', (e) => { settings.visualization.customColor = e.target.value; updateUIFromSettings(); });
        DOM.lineCountSlider.addEventListener('input', (e) => { settings.visualization.lineCount = parseInt(e.target.value); updateUIFromSettings(); });
        DOM.symmetryToggle.addEventListener('change', (e) => { settings.visualization.symmetry.enabled = e.target.checked; updateUIFromSettings(); });
        DOM.repeatAmountSlider.addEventListener('input', (e) => { settings.visualization.symmetry.repeats = parseInt(e.target.value); updateUIFromSettings(); });
        DOM.mirrorToggle.addEventListener('change', (e) => { settings.visualization.symmetry.mirror = e.target.checked; updateUIFromSettings(); });
        DOM.sensitivitySlider.addEventListener('input', (e) => { settings.visualization.sensitivity = parseFloat(e.target.value); updateUIFromSettings(); });
        DOM.smoothingSlider.addEventListener('input', (e) => { settings.visualization.smoothing = parseFloat(e.target.value); if(analyser) analyser.smoothingTimeConstant = settings.visualization.smoothing; updateUIFromSettings(); });
    }

    function initialize() {
        resizeCanvas();
        setupEventListeners();
        updateUIFromSettings();
    }

    initialize();
});
