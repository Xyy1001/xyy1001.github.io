const content_dir = 'contents/'
const config_file = 'config.yml'
const section_names = ['home', 'publications', 'awards']

const readingStorageKey = 'reading-list-data-v1';
const defaultReadingCategories = ['Machine Learning', 'Software Engineering', 'Product Thinking'];
const readingDbConfig = {
    name: 'reading-list-db',
    version: 1,
    store: 'bookFiles'
};

let readingDB = null;


window.addEventListener('DOMContentLoaded', event => {

    // Activate Bootstrap scrollspy on the main nav element
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            offset: 74,
        });
    };

    // Collapse responsive navbar when toggler is visible
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });


    // Yaml
    fetch(content_dir + config_file)
        .then(response => response.text())
        .then(text => {
            const yml = jsyaml.load(text);
            Object.keys(yml).forEach(key => {
                try {
                    document.getElementById(key).innerHTML = yml[key];
                } catch {
                    console.log("Unknown id and value: " + key + "," + yml[key].toString())
                }

            })
        })
        .catch(error => console.log(error));


    // Marked
    marked.use({ mangle: false, headerIds: false })
    section_names.forEach((name, idx) => {
        fetch(content_dir + name + '.md')
            .then(response => response.text())
            .then(markdown => {
                const html = marked.parse(markdown);
                document.getElementById(name + '-md').innerHTML = html;
            }).then(() => {
                // MathJax
                MathJax.typeset();
            })
            .catch(error => console.log(error));
    });

    initReadingList();

});

async function initReadingList() {
    const requiredIds = [
        'categoryInput',
        'addCategoryBtn',
        'categoryChips',
        'bookCategorySelect',
        'bookTitleInput',
        'bookAuthorInput',
        'bookFileInput',
        'bookNoteInput',
        'addBookBtn',
        'bookListContainer'
    ];

    const hasAllNodes = requiredIds.every(id => document.getElementById(id));
    if (!hasAllNodes) {
        return;
    }

    readingDB = await openReadingDB();

    const state = readReadingState();

    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const addBookBtn = document.getElementById('addBookBtn');

    addCategoryBtn.addEventListener('click', () => {
        const categoryInput = document.getElementById('categoryInput');
        const category = categoryInput.value.trim();
        if (!category) {
            return;
        }

        if (!state.categories.includes(category)) {
            state.categories.push(category);
            saveReadingState(state);
            renderCategories(state);
            renderCategorySelect(state);
        }
        categoryInput.value = '';
    });

    addBookBtn.addEventListener('click', async () => {
        const category = document.getElementById('bookCategorySelect').value;
        const title = document.getElementById('bookTitleInput').value.trim();
        const author = document.getElementById('bookAuthorInput').value.trim();
        const note = document.getElementById('bookNoteInput').value.trim();
        const fileInput = document.getElementById('bookFileInput');
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

        if (!category || !title) {
            alert('Please provide at least category and title.');
            return;
        }

        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            category,
            title,
            author,
            note,
            createdAt: new Date().toISOString(),
            hasFile: Boolean(file),
            fileName: file ? file.name : ''
        };

        if (file && readingDB) {
            await putFileBlob(entry.id, file);
        }

        state.books.unshift(entry);
        saveReadingState(state);
        renderBookList(state);

        document.getElementById('bookTitleInput').value = '';
        document.getElementById('bookAuthorInput').value = '';
        document.getElementById('bookNoteInput').value = '';
        document.getElementById('bookFileInput').value = '';
    });

    renderCategories(state);
    renderCategorySelect(state);
    renderBookList(state);
}

function readReadingState() {
    const raw = localStorage.getItem(readingStorageKey);
    if (!raw) {
        return {
            categories: [...defaultReadingCategories],
            books: []
        };
    }

    try {
        const parsed = JSON.parse(raw);
        const categories = Array.isArray(parsed.categories) ? parsed.categories : [...defaultReadingCategories];
        const books = Array.isArray(parsed.books) ? parsed.books : [];
        return { categories, books };
    } catch {
        return {
            categories: [...defaultReadingCategories],
            books: []
        };
    }
}

function saveReadingState(state) {
    localStorage.setItem(readingStorageKey, JSON.stringify(state));
}

function renderCategories(state) {
    const chips = document.getElementById('categoryChips');
    chips.innerHTML = '';
    state.categories.forEach(category => {
        const span = document.createElement('span');
        span.className = 'category-chip';
        span.textContent = category;
        chips.appendChild(span);
    });
}

function renderCategorySelect(state) {
    const select = document.getElementById('bookCategorySelect');
    const previousValue = select.value;
    select.innerHTML = '';

    state.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });

    if (state.categories.includes(previousValue)) {
        select.value = previousValue;
    }
}

function renderBookList(state) {
    const container = document.getElementById('bookListContainer');
    container.innerHTML = '';

    if (state.books.length === 0) {
        container.innerHTML = '<p class="book-empty">No entries yet. Add your first recommended book.</p>';
        return;
    }

    state.books.forEach(entry => {
        const card = document.createElement('article');
        card.className = 'book-entry';

        const meta = entry.author ? `Author: ${escapeHtml(entry.author)} | ` : '';
        const noteHtml = entry.note ? `<p class="book-note">${escapeHtml(entry.note)}</p>` : '';
        const downloadHtml = entry.hasFile
            ? `<button class="btn btn-sm btn-outline-light download-book-btn" data-id="${entry.id}">Open File (${escapeHtml(entry.fileName || 'uploaded')})</button>`
            : '';

        card.innerHTML = `
            <div class="book-entry-head">
                <span class="book-tag">${escapeHtml(entry.category)}</span>
                <h6>${escapeHtml(entry.title)}</h6>
            </div>
            <p class="book-meta">${meta}Added: ${new Date(entry.createdAt).toLocaleDateString()}</p>
            ${noteHtml}
            <div class="book-entry-actions">
                ${downloadHtml}
                <button class="btn btn-sm btn-outline-danger delete-book-btn" data-id="${entry.id}">Delete</button>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.delete-book-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const id = event.currentTarget.getAttribute('data-id');
            state.books = state.books.filter(book => book.id !== id);
            saveReadingState(state);
            if (readingDB) {
                await deleteFileBlob(id);
            }
            renderBookList(state);
        });
    });

    container.querySelectorAll('.download-book-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const id = event.currentTarget.getAttribute('data-id');
            const blob = await getFileBlob(id);
            if (!blob) {
                alert('File not found in local storage. Please upload again.');
                return;
            }
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        });
    });
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function openReadingDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }

        const request = indexedDB.open(readingDbConfig.name, readingDbConfig.version);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(readingDbConfig.store)) {
                db.createObjectStore(readingDbConfig.store);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

function putFileBlob(id, fileBlob) {
    return new Promise((resolve) => {
        if (!readingDB) {
            resolve();
            return;
        }
        const tx = readingDB.transaction(readingDbConfig.store, 'readwrite');
        tx.objectStore(readingDbConfig.store).put(fileBlob, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

function getFileBlob(id) {
    return new Promise((resolve) => {
        if (!readingDB) {
            resolve(null);
            return;
        }
        const tx = readingDB.transaction(readingDbConfig.store, 'readonly');
        const request = tx.objectStore(readingDbConfig.store).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

function deleteFileBlob(id) {
    return new Promise((resolve) => {
        if (!readingDB) {
            resolve();
            return;
        }
        const tx = readingDB.transaction(readingDbConfig.store, 'readwrite');
        tx.objectStore(readingDbConfig.store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}
