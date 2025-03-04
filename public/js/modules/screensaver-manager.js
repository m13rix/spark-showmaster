class ScreenSaverManager {
    constructor() {
        this.screensavers = [];
        this.currentIndex = 0;
        this.isActive = false;
        this.panel = document.getElementById('screensaverPanel');
        this.initDnD();
        this.initKeyboardControls();
        this.pressedKeys = {};
        this.modal = document.getElementById('generationModal');
        this.generatedImage = "";
        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('generateScreensaverBtn').addEventListener('click', () => this.showModal());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('startGenerationBtn').addEventListener('click', () => this.startGeneration());
    }

    showModal() {
        this.modal.style.display = 'flex';
        gsap.to(this.modal.querySelector('.generation-modal-content'), {
            duration: 0.3,
            scale: 1,
            opacity: 1,
            ease: "back.out(1.7)"
        });
    }

    hideModal() {
        gsap.to(this.modal.querySelector('.generation-modal-content'), {
            duration: 0.2,
            scale: 0.8,
            opacity: 0,
            ease: "power2.in",
            onComplete: () => this.modal.style.display = 'none'
        });
    }

    async startGeneration() {
        const prompt = document.getElementById('promptInput').value;

        const preview = document.getElementById('previewContainer');
        preview.classList.add('generating');

        preview.innerHTML = '<div class="loading-animation" id="loading-animation" style="display: none;">\n' +
            '                    <div class="flux-particle"></div>\n' +
            '                    <div class="flux-particle"></div>\n' +
            '                    <div class="flux-particle"></div>\n' +
            '                </div>';

        document.getElementById('loading-animation').style.display = 'flex';
        gsap.to(document.getElementById('loading-animation').querySelector('.flux-particle'), {
            duration: 0.5,
            scale: 1,
            opacity: 1,
            ease: "back.out(1.7)"
        });

        try {
            const response = await fetch('https://stagemaster.up.railway.app/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error);
            }

            // Создаем изображение из base64
            const img = new Image();
            img.src = `data:image/png;base64,${data.image}`;
            this.generatedImage = `data:image/png;base64,${data.image}`;

            // Очищаем превью и добавляем изображение
            preview.innerHTML = '';
            preview.appendChild(img);

            document.getElementById('saveGenerationBtn').addEventListener('click', this.handleClickOnce.bind(this));
        } catch (error) {
            alert(`Ошибка генерации: ${error.message}`);
        } finally {
            preview.classList.remove('generating');
        }
    }
    handleClickOnce() {
        const img = this.generatedImage;
        // Сохраняем в библиотеку
        this.addToLibrary({
            id: `gen-${Date.now()}`,
            url: img,
            type: 'image'
        });
        document.getElementById('saveGenerationBtn').removeEventListener('click', this.handleClickOnce);
    }

    addToLibrary(imageData) {
        const fakeMediaFile = {
            id: imageData.id,
            url: imageData.url,
            type: 'image',
            name: 'Сгенерированный скринсейвер',
            duration: 0
        };

        this.addScreensaver(fakeMediaFile);
    }

    initDnD() {
        // Перетаскивание из медиатеки
        this.panel.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        this.panel.addEventListener('drop', (e) => {
            e.preventDefault();
            const mediaId = e.dataTransfer.getData('media/id');
            const mediaFile = window.mediaBrowser.mediaFiles.find(f => f.id == mediaId);
            if (mediaFile?.type === 'image') {
                this.addScreensaver(mediaFile);
            }
        });

        // Внутренний DnD для перестановки
        this.panel.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.screensaver-item');
            if (!item) return;
            e.dataTransfer.setData('screensaver/id', item.dataset.id);
        });

        this.panel.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('.screensaver-item');
            if (!target) return;

            const rect = target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / rect.height > 0.5;
            this.draggedOver = { target, next };
        });

        this.panel.addEventListener('drop', (e) => {
            const draggedId = e.dataTransfer.getData('screensaver/id');
            const draggedItem = this.screensavers.find(s => s.id == draggedId);
            const targetIndex = this.screensavers.findIndex(s => s.id == this.draggedOver?.target?.dataset.id);

            if (draggedItem && targetIndex >= 0) {
                this.reorderScreensavers(
                    this.screensavers.indexOf(draggedItem),
                    this.draggedOver.next ? targetIndex + 1 : targetIndex
                );
            }
        });
    }

    addScreensaver(mediaFile) {
        const screensaver = {
            id: `ss-${Date.now()}`,
            mediaId: mediaFile.id,
            url: mediaFile.url,
            element: this.createScreensaverElement(mediaFile)
        };

        this.screensavers.push(screensaver);
        this.panel.appendChild(screensaver.element);
        this.updateOrder();
    }

    createScreensaverElement(mediaFile) {
        const item = document.createElement('div');
        item.className = 'screensaver-item';
        item.dataset.id = mediaFile.id;
        item.draggable = true;

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'screensaver-preview';

        const img = document.createElement('img');
        img.src = mediaFile.url;

        // Превью с мини-блюром
        const bg = document.createElement('div');
        bg.className = 'screensaver-preview-bg';
        bg.style.backgroundImage = `url(${mediaFile.url})`;

        imgWrapper.appendChild(bg);
        imgWrapper.appendChild(img);
        item.appendChild(imgWrapper);

        return item;
    }

    reorderScreensavers(fromIndex, toIndex) {
        const moved = this.screensavers.splice(fromIndex, 1)[0];
        this.screensavers.splice(toIndex, 0, moved);
        this.updateOrder();
    }

    updateOrder() {
        this.panel.innerHTML = '';
        this.screensavers.forEach(s => this.panel.appendChild(s.element));
    }

    initKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            this.pressedKeys[e.code] = true;
            if (this.pressedKeys['KeyS'] && e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (e.key === 'ArrowRight') this.next();
                if (e.key === 'ArrowLeft') this.previous();
                this.showCurrent();
            }
        });
        document.addEventListener('keyup', (event) => {
            this.pressedKeys[event.code] = false; // Запоминаем, что клавиша отпущена
        });
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.screensavers.length;
    }

    previous() {
        this.currentIndex = (this.currentIndex - 1 + this.screensavers.length) % this.screensavers.length;
    }

    showCurrent() {
        if (!this.screensavers.length) return;
        if (document.querySelector('.screensaver-overlay')?.classList.contains('hiding')) return;
        this.hide();

        const overlay = document.createElement('div');
        overlay.className = 'screensaver-overlay';

        // Создаем блюр-фон
        const bgImage = new Image();
        bgImage.className = 'screensaver-background';
        bgImage.src = this.screensavers[this.currentIndex].url;

        // Создаем основное изображение
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'screensaver-content';

        const mainImage = new Image();
        mainImage.src = this.screensavers[this.currentIndex].url;

        contentWrapper.appendChild(mainImage);
        overlay.appendChild(bgImage);
        overlay.appendChild(contentWrapper);

        document.body.appendChild(overlay);
        this.isActive = true;

        // Автоматическое удаление при клике
        overlay.addEventListener('click', () => this.hide());
    }

    hide() {
        const overlay = document.querySelector('.screensaver-overlay');
        if (overlay) {
            overlay.classList.add('hiding');
            setTimeout(() => {
                overlay.remove();
                this.isActive = false;
            }, 500); // Должно совпадать с длительностью fadeOut
        }
    }
}
