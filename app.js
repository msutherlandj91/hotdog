(function () {
    'use strict';

    const video = document.getElementById('camera');
    const canvas = document.getElementById('snapshot-canvas');
    const snapBtn = document.getElementById('snap-btn');
    const resultOverlay = document.getElementById('result-overlay');
    const resultText = document.getElementById('result-text');
    const loadingScreen = document.getElementById('loading-screen');
    const fileInput = document.getElementById('file-input');
    const cameraContainer = document.getElementById('camera-container');
    const ctx = canvas.getContext('2d');

    // ImageNet labels that count as "hot dog"
    const HOTDOG_LABELS = [
        'hotdog', 'hot dog', 'hot_dog', 'red hot'
    ];

    let model = null;
    let cameraAvailable = false;
    let analyzing = false;

    function isHotDog(predictions) {
        for (const pred of predictions) {
            const label = pred.className.toLowerCase();
            for (const hotdogLabel of HOTDOG_LABELS) {
                if (label.includes(hotdogLabel)) {
                    return { match: true, confidence: pred.probability };
                }
            }
        }
        return { match: false, confidence: 0 };
    }

    function showResult(isHotDogResult) {
        resultOverlay.classList.remove('hidden');
        resultText.className = '';

        if (isHotDogResult.match) {
            resultText.classList.add('hotdog');
            resultText.textContent = 'HOT DOG!';
        } else {
            resultText.classList.add('not-hotdog');
            resultText.textContent = 'NOT\nHOT DOG';
        }
    }

    function hideResult() {
        resultOverlay.classList.add('hidden');
        canvas.style.display = 'none';
        video.style.display = 'block';
    }

    async function analyzeImage(imageElement) {
        if (!model || analyzing) return;
        analyzing = true;
        snapBtn.disabled = true;

        try {
            const predictions = await model.classify(imageElement, 5);
            const result = isHotDog(predictions);
            showResult(result);
        } catch (err) {
            console.error('Classification error:', err);
            resultOverlay.classList.remove('hidden');
            resultText.className = 'not-hotdog';
            resultText.textContent = 'ERROR';
        } finally {
            analyzing = false;
            snapBtn.disabled = false;
        }
    }

    function captureFromVideo() {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        video.style.display = 'none';
        canvas.style.display = 'block';
        analyzeImage(canvas);
    }

    async function setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            video.srcObject = stream;
            cameraAvailable = true;
        } catch (err) {
            console.warn('Camera not available, using file fallback:', err);
            cameraAvailable = false;
            video.style.display = 'none';
            cameraContainer.classList.add('fallback');
        }
    }

    function handleFileInput(e) {
        const file = e.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            video.style.display = 'none';
            canvas.style.display = 'block';
            resultOverlay.classList.add('hidden');
            analyzeImage(canvas);
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    }

    snapBtn.addEventListener('click', function () {
        if (analyzing) return;

        // If result is showing, dismiss it and go back to camera
        if (!resultOverlay.classList.contains('hidden')) {
            hideResult();
            fileInput.value = '';
            return;
        }

        if (cameraAvailable) {
            captureFromVideo();
        } else {
            fileInput.click();
        }
    });

    cameraContainer.addEventListener('click', function () {
        if (!cameraAvailable && !analyzing) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', handleFileInput);

    // Dismiss result on tap
    resultOverlay.addEventListener('click', function () {
        hideResult();
        fileInput.value = '';
    });

    async function init() {
        await setupCamera();

        try {
            model = await mobilenet.load({ version: 2, alpha: 1.0 });
        } catch (err) {
            console.error('Failed to load model:', err);
            loadingScreen.querySelector('p').textContent = 'Failed to load AI model. Please refresh.';
            return;
        }

        loadingScreen.classList.add('hidden');
    }

    init();
})();
