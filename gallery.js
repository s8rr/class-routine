// ── Config ──────────────────────────────────────────────────────────────
// Filenames are discovered automatically via the GitHub Contents API, so
// dropping a new image into routine_images/ and pushing is all that's
// needed — no manual list to maintain. Update owner/repo/branch below if
// this site ever moves to a different repository.
const GALLERY_CONFIG = {
    owner: 's8rr',
    repo: 'class-routine',
    branch: 'main',
    path: 'routine_images',
};

// Optional manual backstop. Only used if the GitHub API lookup fails (e.g.
// no network, rate-limited, or running off GitHub Pages). Anything listed
// here is merged in alongside whatever the API finds.
const MANUAL_FALLBACK_IMAGES = [
    // 'section_61_A.jpg',
    // 'section_61_B.jpg',
];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

// ── DOM refs ────────────────────────────────────────────────────────────
const galleryMount = document.getElementById('gallery-mount');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryEmptyTitle = document.getElementById('gallery-empty-title');
const galleryEmptyBody = document.getElementById('gallery-empty-body');
const galleryCount = document.getElementById('gallery-count');
const galleryStatus = document.getElementById('gallery-status');
const filterInput = document.getElementById('filter-input');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');

let allImages = [];
let visibleImages = [];
let currentIndex = -1;

// ── Helpers ─────────────────────────────────────────────────────────────
function setStatus(label, colorClass) {
    galleryStatus.textContent = label;
    galleryStatus.className = colorClass;
}

function toEntry(name) {
    return { name, src: `${GALLERY_CONFIG.path}/${encodeURIComponent(name)}` };
}

function dedupeByName(images) {
    const seen = new Map();
    images.forEach((img) => seen.set(img.name, img));
    return Array.from(seen.values());
}

function sortByName(images) {
    return images
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

async function fetchImageList() {
    const { owner, repo, branch, path } = GALLERY_CONFIG;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected response shape');
    return data
        .filter((item) => item.type === 'file' && IMAGE_EXT.test(item.name))
        .map((item) => toEntry(item.name));
}

// ── Rendering ───────────────────────────────────────────────────────────
function renderGallery(images) {
    galleryMount.innerHTML = '';

    if (images.length === 0) {
        galleryMount.classList.add('hidden');
        galleryEmpty.classList.remove('hidden');
        return;
    }
    galleryMount.classList.remove('hidden');
    galleryEmpty.classList.add('hidden');

    images.forEach((img, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('aria-label', `Open ${img.name}`);
        card.className =
            'group bg-[#050505] border border-neutral-900 hover:border-neutral-700 rounded-xl overflow-hidden text-left transition-colors focus:outline-none focus-visible:border-blue-500/60';

        const imgWrap = document.createElement('div');
        imgWrap.className = 'aspect-[4/3] bg-[#0a0a0a] overflow-hidden';

        const imageEl = document.createElement('img');
        imageEl.src = img.src;
        imageEl.alt = img.name;
        imageEl.loading = 'lazy';
        imageEl.decoding = 'async';
        imageEl.className = 'w-full h-full object-cover group-hover:opacity-90 transition-opacity';
        imageEl.onerror = () => card.remove();

        const caption = document.createElement('div');
        caption.className = 'px-3 py-2 text-[11px] font-mono text-neutral-500 truncate';
        caption.textContent = img.name;

        imgWrap.appendChild(imageEl);
        card.appendChild(imgWrap);
        card.appendChild(caption);
        card.addEventListener('click', () => openLightbox(index));

        galleryMount.appendChild(card);
    });
}

function applyFilter() {
    const query = filterInput.value.trim().toLowerCase();
    visibleImages = query
        ? allImages.filter((img) => img.name.toLowerCase().includes(query))
        : allImages.slice();

    renderGallery(visibleImages);
    galleryCount.textContent = `${visibleImages.length} image${visibleImages.length === 1 ? '' : 's'}`;
}

// ── Lightbox ────────────────────────────────────────────────────────────
function openLightbox(index) {
    currentIndex = index;
    updateLightboxImage();
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
    document.body.style.overflow = '';
}

function updateLightboxImage() {
    const img = visibleImages[currentIndex];
    if (!img) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.name;
    lightboxCaption.textContent = img.name;
}

function showNext() {
    if (visibleImages.length === 0) return;
    currentIndex = (currentIndex + 1) % visibleImages.length;
    updateLightboxImage();
}

function showPrev() {
    if (visibleImages.length === 0) return;
    currentIndex = (currentIndex - 1 + visibleImages.length) % visibleImages.length;
    updateLightboxImage();
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-next').addEventListener('click', showNext);
document.getElementById('lightbox-prev').addEventListener('click', showPrev);
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
});

filterInput.addEventListener('input', applyFilter);

// ── Init ────────────────────────────────────────────────────────────────
async function init() {
    const manualImages = MANUAL_FALLBACK_IMAGES.map(toEntry);

    try {
        const apiImages = await fetchImageList();
        allImages = sortByName(dedupeByName([...apiImages, ...manualImages]));
        setStatus('Synced', 'text-green-500');
    } catch (err) {
        console.warn('GitHub API lookup failed, using manual fallback list:', err);
        allImages = sortByName(manualImages);
        setStatus(manualImages.length ? 'Local fallback' : 'Offline', manualImages.length ? 'text-amber-500' : 'text-red-500');
    }

    if (allImages.length === 0) {
        galleryEmptyTitle.textContent = 'No images found';
        galleryEmptyBody.textContent =
            galleryStatus.textContent === 'Synced'
                ? `routine_images/ is empty right now. Drop image files into that folder and push — they'll show up here automatically.`
                : `Couldn't reach the GitHub API to list routine_images/. Add filenames to MANUAL_FALLBACK_IMAGES at the top of gallery.js, or check your connection.`;
    }

    applyFilter();
}

init();