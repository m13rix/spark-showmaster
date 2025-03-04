class MediaBrowser {
    constructor() {
        this.mediaFiles = [];
        this.draggedItem = null;
        this.draggedItemId = null;
        this.initDnD();
        this.renderMediaItems();
    }

    initDnD() {
        const browser = document.getElementById('mediaBrowser');
        const itemsContainer = document.getElementById('mediaItems');

        browser.addEventListener('dragover', this.handleDragOver.bind(this));
        browser.addEventListener('dragleave', this.handleDragLeave.bind(this));
        browser.addEventListener('drop', this.handleDrop.bind(this));

        itemsContainer.addEventListener('dragstart', this.handleDragStart.bind(this));
        // В методе initDnD() MediaBrowser:
        itemsContainer.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.media-item');
            if (!item) return;

            const mediaId = item.dataset.id;
            e.dataTransfer.setData('media/id', mediaId);
            e.dataTransfer.effectAllowed = 'copy';
        });
        itemsContainer.addEventListener('dragover', this.handleItemDragOver.bind(this));
        itemsContainer.addEventListener('dragenter', this.handleItemDragEnter.bind(this));
        itemsContainer.addEventListener('dragleave', this.handleItemDragLeave.bind(this));
        itemsContainer.addEventListener('dragend', this.handleDragEnd.bind(this));
        itemsContainer.addEventListener('drop', this.handleItemDrop.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('mediaBrowser').classList.add('dragover');
    }

    handleDragLeave() {
        document.getElementById('mediaBrowser').classList.remove('dragover');
    }

    async handleDrop(e) {
        e.preventDefault();
        document.getElementById('mediaBrowser').classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        await this.processFiles(files);
    }

    handleDragStart(e) {
        this.draggedItem = e.target.closest('.media-item');
        if (!this.draggedItem) return;

        this.draggedItemId = this.draggedItem.dataset.id;
        e.dataTransfer.setData('text/plain', this.draggedItemId);
        this.draggedItem.classList.add('dragging');
    }

    handleItemDragOver(e) {
        e.preventDefault();
    }

    handleItemDragEnter(e) {
        e.preventDefault();
        const targetItem = e.target.closest('.media-item');

        if (!targetItem || !this.draggedItem || targetItem === this.draggedItem) {
            return;
        }

        const itemsContainer = document.getElementById('mediaItems');
        const draggedIndex = this.getElementIndex(this.draggedItem);
        const targetIndex = this.getElementIndex(targetItem);

        if (draggedIndex < targetIndex) {
            itemsContainer.insertBefore(this.draggedItem, targetItem.nextElementSibling);
        } else {
            itemsContainer.insertBefore(this.draggedItem, targetItem);
        }
    }

    handleItemDragLeave(e) {
        // Можно добавить визуальные эффекты при выходе с элемента, если нужно
    }

    handleDragEnd(e) {
        if (this.draggedItem) {
            this.draggedItem.classList.remove('dragging');
            this.draggedItem = null;
            this.draggedItemId = null;
        }
    }

    handleItemDrop(e) {
        e.preventDefault();
        if (!this.draggedItemId) return;

        const droppedItemId = this.draggedItemId;
        const droppedItemElement = document.querySelector(`.media-item[data-id="${droppedItemId}"]`);
        if (!droppedItemElement) return;

        this.updateMediaFilesOrder();
    }


    getElementIndex(element) {
        if (!element || !element.parentNode) return -1;
        return Array.from(element.parentNode.children).indexOf(element);
    }


    async processFiles(files) {
        for (const file of files) {
            try {
                const mediaFile = await this.createMediaFile(file);
                this.mediaFiles.push(mediaFile);
                this.renderMediaItem(mediaFile);
                this.updateMediaFilesOrder();
            } catch (error) {
                console.error('Error processing file:', error);
            }
        }
    }

    createMediaFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const mediaType = file.type.startsWith('audio/') ? 'audio' :
                    file.type.startsWith('video/') ? 'video' :
                        file.type.startsWith('image/') ? 'image' :
                            'unknown';

                const mediaFile = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: mediaType,
                    duration: 0,
                    thumbnail: null,
                    file: file,
                    url: URL.createObjectURL(file)
                };

                if (mediaType === 'audio') this.getAudioDuration(mediaFile).then(resolve);
                else if (mediaType === 'video') this.getVideoDuration(mediaFile).then(resolve);
                else resolve(mediaFile);
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async getAudioDuration(mediaFile) {
        const audio = new Audio();
        audio.src = mediaFile.url;

        return new Promise((resolve) => {
            audio.addEventListener('loadedmetadata', () => {
                mediaFile.duration = audio.duration;
                resolve(mediaFile);
            });
        });
    }

    async getVideoDuration(mediaFile) {
        const video = document.createElement('video');
        video.src = mediaFile.url;

        return new Promise((resolve) => {
            video.addEventListener('loadedmetadata', () => {
                mediaFile.duration = video.duration;
                resolve(mediaFile);
            });
        });
    }

    renderMediaItem(mediaFile) {
        const itemsContainer = document.getElementById('mediaItems');

        const item = document.createElement('div');
        item.className = 'media-item';
        item.dataset.id = mediaFile.id;
        item.draggable = true;
        const truncatedName = mediaFile.name.length > 22 ? mediaFile.name.substring(0, 22) + '...' : mediaFile.name; // Обрезание имени
        item.innerHTML = `
                         <i class="${this.getDefaultThumbnail(mediaFile.type)}"></i>
                    <div class="media-info">
                        <div>${this.formatDuration(mediaFile.duration)}</div>
                        <div>${truncatedName}</div>
                    </div>
                `;

        itemsContainer.appendChild(item);
    }

    renderMediaItems() {
        const itemsContainer = document.getElementById('mediaItems');
        itemsContainer.innerHTML = '';
        this.mediaFiles.forEach(mediaFile => {
            this.renderMediaItem(mediaFile);
        });
    }

    updateMediaFilesOrder() {
        const itemsContainer = document.getElementById('mediaItems');
        const currentOrder = Array.from(itemsContainer.children).map(item => item.dataset.id);
        const orderedMediaFiles = [];
        currentOrder.forEach(id => {
            const file = this.mediaFiles.find(file => file.id.toString() === id);
            if (file) {
                orderedMediaFiles.push(file);
            }
        });
        this.mediaFiles = orderedMediaFiles;
        //console.log("Updated mediaFiles order:", this.mediaFiles.map(file => file.name));
    }


    getDefaultThumbnail(type) {
        return type === 'audio' ? 'fa-solid fa-file-audio' :
            type === 'video' ? 'fa-solid fa-file-video' :
                type === 'image' ? 'fa-solid fa-file-image' :
                    'fa-solid fa-file';
    }

    formatDuration(seconds) {
        if (!seconds) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}
