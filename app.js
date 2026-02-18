// ============ TAB SWITCHING ============
function showTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    btn.classList.add('active');
    document.getElementById('tab-' + tabName).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setStatus(id, msg, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'status' + (isError ? ' error' : '');
}

function downloadCanvas(canvas, filename) {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
}

// ============ RESIZE TO KB ============
let resizeOriginalFile = null;

function loadResizeImage(e) {
    resizeOriginalFile = e.target.files[0];
    if (!resizeOriginalFile) return;
    const url = URL.createObjectURL(resizeOriginalFile);
    const img = document.getElementById('resizeImg');
    img.src = url;
    document.getElementById('resizePreview').style.display = 'flex';
    setStatus('resizeStatus', '✅ Photo loaded! Enter target KB and click Download.');
}

async function resizeToKB() {
    if (!resizeOriginalFile) return setStatus('resizeStatus', 'Please upload a photo first!', true);
    const targetKB = parseFloat(document.getElementById('resizeKB').value);
    if (!targetKB || targetKB < 1) return setStatus('resizeStatus', 'Enter a valid KB value!', true);
    const format = document.getElementById('resizeFormat').value;
    const mimeType = 'image/' + format;
    setStatus('resizeStatus', '⏳ Processing... please wait.');

    const img = new Image();
    img.src = URL.createObjectURL(resizeOriginalFile);
    img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let low = 0.01, high = 1.0, quality, blob;
        for (let i = 0; i < 30; i++) {
            quality = (low + high) / 2;
            blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
            const sizeKB = blob.size / 1024;
            if (Math.abs(sizeKB - targetKB) < 0.5) break;
            if (sizeKB > targetKB) high = quality;
            else low = quality;
        }

        // Downscale if still too big
        if (blob.size / 1024 > targetKB * 1.1) {
            let scale = 0.9;
            while (blob.size / 1024 > targetKB && scale > 0.05) {
                canvas.width = Math.max(1, img.width * scale);
                canvas.height = Math.max(1, img.height * scale);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
                scale -= 0.05;
            }
        }

        const finalKB = (blob.size / 1024).toFixed(1);
        setStatus('resizeStatus', `✅ Done! Final size: ${finalKB} KB`);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `resized_${targetKB}kb.${format === 'jpeg' ? 'jpg' : format}`;
        a.click();
    };
}

// ============ BG REMOVE ============
let bgRemoveFile = null;
let bgRemovedBlob = null;

function loadBgRemoveImage(e) {
    bgRemoveFile = e.target.files[0];
    if (!bgRemoveFile) return;
    document.getElementById('bgRemovedImg').src = URL.createObjectURL(bgRemoveFile);
    document.getElementById('bgRemovePreview').style.display = 'flex';
    document.getElementById('bgRemoveDownload').style.display = 'none';
    setStatus('bgRemoveStatus', '✅ Photo loaded! Click "Remove Background".');
}

async function removeBackground() {
    if (!bgRemoveFile) return setStatus('bgRemoveStatus', 'Please upload a photo first!', true);
    setStatus('bgRemoveStatus', '⏳ Removing background... (first run loads AI model, ~30 sec)');
    try {
        const imglyBR = window['@imgly/background-removal'] || window.BackgroundRemoval;
        const blob = await imglyBR.removeBackground(bgRemoveFile);
        bgRemovedBlob = blob;
        document.getElementById('bgRemovedImg').src = URL.createObjectURL(blob);
        document.getElementById('bgRemovePreview').style.display = 'flex';
        document.getElementById('bgRemoveDownload').style.display = 'inline-block';
        setStatus('bgRemoveStatus', '✅ Background removed! Download your PNG.');
    } catch (err) {
        setStatus('bgRemoveStatus', '⚠️ Model loading failed. Refresh and try again.', true);
        console.error(err);
    }
}

function downloadBgRemoved() {
    if (!bgRemovedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(bgRemovedBlob);
    a.download = 'bg_removed.png';
    a.click();
}

// ============ BG ADD ============
let bgAddImg = null;
let bgCustomImage = null;

function loadBgAddImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    bgAddImg = new Image();
    bgAddImg.crossOrigin = 'anonymous';
    bgAddImg.src = URL.createObjectURL(file);
    bgAddImg.onload = () => {
        document.getElementById('bgAddPreview').style.display = 'flex';
        applyBackground();
    };
}

function loadBgImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    bgCustomImage = new Image();
    bgCustomImage.crossOrigin = 'anonymous';
    bgCustomImage.src = URL.createObjectURL(file);
    bgCustomImage.onload = () => { if (bgAddImg) applyBackground(); };
}

function applyBackground() {
    if (!bgAddImg) return;
    const canvas = document.getElementById('bgAddCanvas');
    canvas.width = bgAddImg.naturalWidth || bgAddImg.width;
    canvas.height = bgAddImg.naturalHeight || bgAddImg.height;
    const ctx = canvas.getContext('2d');

    if (bgCustomImage) {
        ctx.drawImage(bgCustomImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = document.getElementById('bgColor').value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bgAddImg, 0, 0, canvas.width, canvas.height);
    document.getElementById('bgAddDownload').style.display = 'inline-block';
}

function downloadBgAdded() {
    downloadCanvas(document.getElementById('bgAddCanvas'), 'photo_with_bg.png');
}

// ============ MERGE ============
let mergeImage1 = null, mergeImage2 = null;

function loadMerge1(e) {
    const file = e.target.files[0];
    if (!file) return;
    mergeImage1 = new Image();
    mergeImage1.src = URL.createObjectURL(file);
    mergeImage1.onload = () => {
        const el = document.getElementById('mergeImg1');
        el.src = mergeImage1.src;
        el.style.display = 'block';
    };
}

function loadMerge2(e) {
    const file = e.target.files[0];
    if (!file) return;
    mergeImage2 = new Image();
    mergeImage2.src = URL.createObjectURL(file);
    mergeImage2.onload = () => {
        const el = document.getElementById('mergeImg2');
        el.src = mergeImage2.src;
        el.style.display = 'block';
    };
}

function mergeImages(type) {
    if (!mergeImage1 || !mergeImage2) {
        alert('Please upload both photos first!');
        return;
    }
    const canvas = document.getElementById('mergeCanvas');
    const ctx = canvas.getContext('2d');
    const i1 = mergeImage1, i2 = mergeImage2;

    if (type === 'horizontal') {
        canvas.width = i1.width + i2.width;
        canvas.height = Math.max(i1.height, i2.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(i1, 0, 0);
        ctx.drawImage(i2, i1.width, 0);
    } else if (type === 'vertical') {
        canvas.width = Math.max(i1.width, i2.width);
        canvas.height = i1.height + i2.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(i1, 0, 0);
        ctx.drawImage(i2, 0, i1.height);
    } else if (type === 'parallel') {
        canvas.width = Math.max(i1.width, i2.width);
        canvas.height = Math.max(i1.height, i2.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // i2 = background, i1 = foreground
        ctx.drawImage(i2, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = parseFloat(document.getElementById('overlayOpacity').value);
        ctx.drawImage(i1, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    document.getElementById('mergePreview').style.display = 'flex';
    document.getElementById('mergeDownload').style.display = 'inline-block';
}

function downloadMerge() {
    downloadCanvas(document.getElementById('mergeCanvas'), 'merged_photo.png');
}

// ============ PHOTO TO PDF ============
let pdfImages = [];

function loadPdfImages(e) {
    pdfImages = Array.from(e.target.files);
    if (!pdfImages.length) return;
    const list = document.getElementById('pdfPreviewList');
    list.innerHTML = '';
    list.style.display = 'flex';
    pdfImages.forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        list.appendChild(img);
    });
    setStatus('pdfStatus', `✅ ${pdfImages.length} photo(s) loaded. Set target KB and create PDF.`);
}

async function convertToPDF() {
    if (!pdfImages.length) return setStatus('pdfStatus', 'Please upload photos first!', true);
    const targetKB = parseFloat(document.getElementById('pdfKB').value);
    if (!targetKB || targetKB < 1) return setStatus('pdfStatus', 'Enter a valid KB value!', true);
    setStatus('pdfStatus', '⏳ Creating PDF...');

    const { jsPDF } = window.jspdf;
    const orientation = document.getElementById('pdfOrientation').value;
    const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const perImageKB = targetKB / pdfImages.length;

    for (let i = 0; i < pdfImages.length; i++) {
        if (i > 0) pdf.addPage();
        const dataUrl = await compressImageForPDF(pdfImages[i], perImageKB);
        const imgProps = pdf.getImageProperties(dataUrl);
        const ratio = Math.min(pageW / imgProps.width, pageH / imgProps.height);
        const w = imgProps.width * ratio;
        const h = imgProps.height * ratio;
        pdf.addImage(dataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
    }

    const pdfBlob = pdf.output('blob');
    setStatus('pdfStatus', `✅ Done! PDF size: ~${(pdfBlob.size / 1024).toFixed(1)} KB`);
    pdf.save(`photo_${targetKB}kb.pdf`);
}

async function compressImageForPDF(file, targetKB) {
    return new Promise(resolve => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            let low = 0.01, high = 1.0, quality = 0.7, dataUrl;
            for (let i = 0; i < 20; i++) {
                quality = (low + high) / 2;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
                const kb = (dataUrl.length * 3 / 4) / 1024;
                if (Math.abs(kb - targetKB) < 2) break;
                if (kb > targetKB) high = quality;
                else low = quality;
            }
            resolve(dataUrl);
        };
    });
}

// ============ DPI CHANGE ============
let dpiFile = null;

function loadDpiImage(e) {
    dpiFile = e.target.files[0];
    if (!dpiFile) return;
    document.getElementById('dpiImg').src = URL.createObjectURL(dpiFile);
    document.getElementById('dpiPreview').style.display = 'flex';
    setStatus('dpiStatus', '✅ Photo loaded! Set DPI and click Apply.');
}

function changeDPI() {
    if (!dpiFile) return setStatus('dpiStatus', 'Please upload a photo first!', true);
    const dpi = parseInt(document.getElementById('dpiValue').value);
    const format = document.getElementById('dpiFormat').value;
    if (!dpi || dpi < 1) return setStatus('dpiStatus', 'Enter a valid DPI value!', true);

    const img = new Image();
    img.src = URL.createObjectURL(dpiFile);
    img.onload = () => {
        const scaleFactor = dpi / 96;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scaleFactor);
        canvas.height = Math.round(img.height * scaleFactor);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (format === 'image/png') {
                blob.arrayBuffer().then(buffer => {
                    const newBuffer = injectPngDPI(buffer, dpi);
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([newBuffer], { type: 'image/png' }));
                    a.download = `photo_${dpi}dpi.png`;
                    a.click();
                    setStatus('dpiStatus', `✅ Done! DPI set to ${dpi} and downloaded.`);
                });
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `photo_${dpi}dpi.jpg`;
                a.click();
                setStatus('dpiStatus', `✅ Done! DPI applied at ${dpi}.`);
            }
        }, format, 0.95);
    };
}

function injectPngDPI(buffer, dpi) {
    const ppm = Math.round(dpi * 39.3701);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let insertPos = 8;
    while (insertPos < bytes.length - 12) {
        const len = view.getUint32(insertPos);
        const type = String.fromCharCode(bytes[insertPos+4], bytes[insertPos+5], bytes[insertPos+6], bytes[insertPos+7]);
        if (type === 'IDAT') break;
        insertPos += 12 + len;
    }
    const pHYs = new Uint8Array(21);
    const pv = new DataView(pHYs.buffer);
    pv.setUint32(0, 9);
    [0x70,0x48,0x59,0x73].forEach((b,i) => pHYs[4+i] = b);
    pv.setUint32(8, ppm);
    pv.setUint32(12, ppm);
    pHYs[16] = 1;
    pv.setUint32(17, crc32(pHYs.slice(4, 17)));
    const result = new Uint8Array(bytes.length + 21);
    result.set(bytes.slice(0, insertPos));
    result.set(pHYs, insertPos);
    result.set(bytes.slice(insertPos), insertPos + 21);
    return result.buffer;
}

function crc32(data) {
    const t = makeCRCTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ t[(crc ^ data[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
    const t = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
    }
    return t;
}
