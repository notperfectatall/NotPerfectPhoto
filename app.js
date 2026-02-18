// ============ TAB SWITCHING ============
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    event.target.classList.add('active');
}

// ============ HELPERS ============
function setStatus(id, msg, isError = false) {
    const el = document.getElementById(id);
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
    const url = URL.createObjectURL(resizeOriginalFile);
    document.getElementById('resizeImg').src = url;
    document.getElementById('resizePreview').style.display = 'flex';
    setStatus('resizeStatus', 'Photo loaded! Enter target KB and click Download.');
}

async function resizeToKB() {
    if (!resizeOriginalFile) return setStatus('resizeStatus', 'Please upload a photo first!', true);
    const targetKB = parseFloat(document.getElementById('resizeKB').value);
    if (!targetKB || targetKB < 1) return setStatus('resizeStatus', 'Please enter a valid KB size!', true);
    const format = document.getElementById('resizeFormat').value;
    const mimeType = 'image/' + format;
    setStatus('resizeStatus', '⏳ Processing...');

    const img = new Image();
    img.src = URL.createObjectURL(resizeOriginalFile);
    img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let quality = 0.95;
        let blob;
        let attempts = 0;

        // Binary search for quality
        let low = 0.01, high = 1.0;
        while (attempts < 30) {
            quality = (low + high) / 2;
            blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
            const sizeKB = blob.size / 1024;
            if (Math.abs(sizeKB - targetKB) < 0.5 || attempts > 25) break;
            if (sizeKB > targetKB) high = quality;
            else low = quality;
            attempts++;
        }

        // If still too large, scale down image
        if (blob.size / 1024 > targetKB * 1.1) {
            let scale = 0.9;
            while (blob.size / 1024 > targetKB && scale > 0.05) {
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
                scale -= 0.05;
            }
        }

        const finalKB = (blob.size / 1024).toFixed(1);
        setStatus('resizeStatus', `✅ Done! Final size: ${finalKB} KB`);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `photo_${targetKB}kb.${format}`;
        a.click();
    };
}

// ============ BACKGROUND REMOVE ============
let bgRemoveFile = null;
let bgRemovedBlob = null;

function loadBgRemoveImage(e) {
    bgRemoveFile = e.target.files[0];
    const url = URL.createObjectURL(bgRemoveFile);
    document.getElementById('bgRemovedImg').src = url;
    document.getElementById('bgRemovePreview').style.display = 'flex';
    setStatus('bgRemoveStatus', 'Photo loaded! Click "Remove Background".');
    document.getElementById('bgRemoveDownload').style.display = 'none';
}

async function removeBackground() {
    if (!bgRemoveFile) return setStatus('bgRemoveStatus', 'Please upload a photo first!', true);
    setStatus('bgRemoveStatus', '⏳ Removing background... (may take 10-30 seconds)');
    try {
        const { removeBackground } = window.BackgroundRemoval || window['@imgly/background-removal'];
        const blob = await removeBackground(bgRemoveFile);
        bgRemovedBlob = blob;
        const url = URL.createObjectURL(blob);
        document.getElementById('bgRemovedImg').src = url;
        document.getElementById('bgRemovePreview').style.display = 'flex';
        document.getElementById('bgRemoveDownload').style.display = 'inline-block';
        setStatus('bgRemoveStatus', '✅ Background removed! Download your PNG.');
    } catch (err) {
        // Fallback: use remove.bg API or show message
        setStatus('bgRemoveStatus', '⚠️ AI model loading... Please wait a moment and try again. (First time takes longer)', true);
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

// ============ BACKGROUND ADD ============
let bgAddImg = null;
let bgCustomImage = null;

function loadBgAddImage(e) {
    const file = e.target.files[0];
    bgAddImg = new Image();
    bgAddImg.src = URL.createObjectURL(file);
    bgAddImg.onload = () => {
        document.getElementById('bgAddPreview').style.display = 'flex';
        applyBackground();
    };
}

function loadBgImage(e) {
    const file = e.target.files[0];
    bgCustomImage = new Image();
    bgCustomImage.src = URL.createObjectURL(file);
    bgCustomImage.onload = () => { if (bgAddImg) applyBackground(); };
}

function applyBackground() {
    if (!bgAddImg) return;
    const canvas = document.getElementById('bgAddCanvas');
    canvas.width = bgAddImg.width;
    canvas.height = bgAddImg.height;
    const ctx = canvas.getContext('2d');

    // Draw background
    if (bgCustomImage) {
        ctx.drawImage(bgCustomImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = document.getElementById('bgColor').value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw foreground image on top
    ctx.drawImage(bgAddImg, 0, 0);
    document.getElementById('bgAddDownload').style.display = 'inline-block';
}

function downloadBgAdded() {
    const canvas = document.getElementById('bgAddCanvas');
    downloadCanvas(canvas, 'photo_with_bg.png');
}

// ============ MERGE ============
let mergeImage1 = null, mergeImage2 = null;

function loadMerge1(e) {
    const file = e.target.files[0];
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
    mergeImage2 = new Image();
    mergeImage2.src = URL.createObjectURL(file);
    mergeImage2.onload = () => {
        const el = document.getElementById('mergeImg2');
        el.src = mergeImage2.src;
        el.style.display = 'block';
    };
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('overlayOpacity').addEventListener('input', function () {
        document.getElementById('opacityVal').textContent = this.value;
    });
});

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
        ctx.drawImage(i1, 0, 0);
        ctx.drawImage(i2, i1.width, 0);
    } else if (type === 'vertical') {
        canvas.width = Math.max(i1.width, i2.width);
        canvas.height = i1.height + i2.height;
        ctx.drawImage(i1, 0, 0);
        ctx.drawImage(i2, 0, i1.height);
    } else if (type === 'parallel') {
        // Overlay merge — i2 is background, i1 is foreground
        canvas.width = Math.max(i1.width, i2.width);
        canvas.height = Math.max(i1.height, i2.height);
        // Draw background (i2)
        ctx.drawImage(i2, 0, 0, canvas.width, canvas.height);
        // Draw foreground (i1) with opacity
        const opacity = parseFloat(document.getElementById('overlayOpacity').value);
        ctx.globalAlpha = opacity;
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
    const list = document.getElementById('pdfPreviewList');
    list.innerHTML = '';
    list.style.display = 'flex';
    pdfImages.forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.maxHeight = '120px';
        img.style.borderRadius = '8px';
        img.style.border = '2px solid #a78bfa44';
        list.appendChild(img);
    });
    setStatus('pdfStatus', `${pdfImages.length} photo(s) loaded! Set target KB and create PDF.`);
}

async function convertToPDF() {
    if (pdfImages.length === 0) return setStatus('pdfStatus', 'Please upload photos first!', true);
    const targetKB = parseFloat(document.getElementById('pdfKB').value);
    if (!targetKB || targetKB < 1) return setStatus('pdfStatus', 'Please enter a valid KB size!', true);
    setStatus('pdfStatus', '⏳ Creating PDF...');

    const { jsPDF } = window.jspdf;
    const orientation = document.getElementById('pdfOrientation').value;
    const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pdfImages.length; i++) {
        const file = pdfImages[i];
        if (i > 0) pdf.addPage();

        // Compress image to fit target size
        const compressedDataUrl = await compressImageForPDF(file, targetKB / pdfImages.length);
        const imgProps = pdf.getImageProperties(compressedDataUrl);
        const ratio = Math.min(pageW / imgProps.width, pageH / imgProps.height);
        const w = imgProps.width * ratio;
        const h = imgProps.height * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        pdf.addImage(compressedDataUrl, 'JPEG', x, y, w, h);
    }

    const pdfBlob = pdf.output('blob');
    const finalKB = (pdfBlob.size / 1024).toFixed(1);
    setStatus('pdfStatus', `✅ PDF created! Size: ~${finalKB} KB`);
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

            let low = 0.01, high = 1.0, quality = 0.7;
            let dataUrl;
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
    const url = URL.createObjectURL(dpiFile);
    document.getElementById('dpiImg').src = url;
    document.getElementById('dpiPreview').style.display = 'flex';
    setStatus('dpiStatus', 'Photo loaded! Set DPI and click Apply.');
}

function changeDPI() {
    if (!dpiFile) return setStatus('dpiStatus', 'Please upload a photo first!', true);
    const dpi = parseInt(document.getElementById('dpiValue').value);
    const format = document.getElementById('dpiFormat').value;
    if (!dpi || dpi < 1) return setStatus('dpiStatus', 'Please enter a valid DPI!', true);

    const img = new Image();
    img.src = URL.createObjectURL(dpiFile);
    img.onload = () => {
        const scaleFactor = dpi / 96; // 96 is browser default DPI
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Embed DPI metadata in PNG using custom chunk
        canvas.toBlob(blob => {
            if (format === 'image/png') {
                // Inject pHYs chunk for PNG DPI
                blob.arrayBuffer().then(buffer => {
                    const newBuffer = injectPngDPI(buffer, dpi);
                    const finalBlob = new Blob([newBuffer], { type: 'image/png' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(finalBlob);
                    a.download = `photo_${dpi}dpi.png`;
                    a.click();
                    setStatus('dpiStatus', `✅ Done! DPI set to ${dpi} and downloaded.`);
                });
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `photo_${dpi}dpi.jpg`;
                a.click();
                setStatus('dpiStatus', `✅ Done! DPI applied. Size scaled to ${dpi} DPI.`);
            }
        }, format, 0.95);
    };
}

// Inject pHYs chunk into PNG for real DPI metadata
function injectPngDPI(buffer, dpi) {
    const ppm = Math.round(dpi * 39.3701); // pixels per meter
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Find IDAT chunk position to insert pHYs before it
    let insertPos = 8; // After PNG signature
    while (insertPos < bytes.length) {
        const len = view.getUint32(insertPos);
        const type = String.fromCharCode(bytes[insertPos+4], bytes[insertPos+5], bytes[insertPos+6], bytes[insertPos+7]);
        if (type === 'IDAT') break;
        insertPos += 12 + len;
    }

    // Build pHYs chunk
    const pHYs = new Uint8Array(21);
    const pHYsView = new DataView(pHYs.buffer);
    pHYsView.setUint32(0, 9); // data length
    pHYs[4] = 0x70; pHYs[5] = 0x48; pHYs[6] = 0x59; pHYs[7] = 0x73; // "pHYs"
    pHYsView.setUint32(8, ppm); // x ppm
    pHYsView.setUint32(12, ppm); // y ppm
    pHYs[16] = 1; // unit: meter
    // CRC32 for pHYs chunk
    const crc = crc32(pHYs.slice(4, 17));
    pHYsView.setUint32(17, crc);

    const result = new Uint8Array(bytes.length + 21);
    result.set(bytes.slice(0, insertPos));
    result.set(pHYs, insertPos);
    result.set(bytes.slice(insertPos), insertPos + 21);
    return result.buffer;
}

function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = makeCRCTable();
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
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
