class Timeline {
    constructor() {
        this.totalDuration = 600;
        this.pixelsPerSecond = 3;
        this.sequence = [];
        this.initRuler();
        this.initTrackDnD();
        this.initScrollHandling();
        this.initKeyboardControls(); // Добавляем обработчик клавиатуры
        this.sequence = [];
        this.playbackStartTime = 0;
        this.scheduledPlaybacks = new Map();
        this.isPlaying = false;
        this.isPaused = false; // Добавляем состояние паузы
        this.pauseTime = 0; // Время паузы для корректного продолжения
        this.slides = [];
        this.currentSlideIndex = 0;
        this.initContextMenu();
        this.initSlideNavigation();
        this.screenSaverManager = window.screenSaverManager;
        this.screenSaverTimeout = null;
        this.pressedKeys = {};
    }

    initContextMenu() {
        document.querySelectorAll('.track-content').forEach(track => {
            track.addEventListener('contextmenu', (e) => {
                const clip = e.target.closest('.timeline-clip');
                if (clip) {
                    e.preventDefault();
                    this.showClipContextMenu(e, clip);
                } else {
                    e.preventDefault();
                    this.showTrackContextMenu(e, track);
                }
            });
        });
    }

    showClipContextMenu(e, clip) {
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.innerHTML = `<div class="menu-item" data-action="deleteClip">Delete Clip</div>`;

        document.body.appendChild(menu);

        menu.querySelector('.menu-item').addEventListener('click', () => {
            this.deleteClip(clip);
            menu.remove();
        });

        document.addEventListener('click', () => menu.remove(), { once: true });
    }

    deleteClip(clipElement) {
        const mediaId = clipElement.dataset.mediaId;

        // Удаляем из DOM
        clipElement.remove();

        // Удаляем из sequence
        this.sequence = this.sequence.filter(item => item.mediaId !== mediaId);

        // Обновляем длительность таймлайна
        this.updateTimelineWidth();
    }

    showTrackContextMenu(e, track) {
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();

        const rect = track.getBoundingClientRect();
        const xPos = e.clientX - rect.left;
        const time = xPos / this.pixelsPerSecond;

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.innerHTML = `
            <div class="menu-item" data-action="addSlide">Add slide</div>
            <div class="menu-item" data-action="deleteSlide">Delete slide</div>
        `;

        document.body.appendChild(menu);

        menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.dataset.action === 'addSlide') {
                    this.addSlideMarker(track, xPos, time);
                } else if (e.target.dataset.action === 'deleteSlide') {
                    this.deleteSlideMarker(track, xPos);
                }
                menu.remove();
            });
        });

        document.addEventListener('click', () => menu.remove(), { once: true });
    }

    deleteSlideMarker(track, xPos) {
        let nearestSlide = null;
        let nearestDistance = -1;
        console.log("deleting")
        this.slides.forEach(slide => {
            const distance = Math.abs((xPos / this.pixelsPerSecond) - slide.element.dataset.time);
            console.log(distance)
            if (nearestSlide){
                if (distance < nearestDistance) {
                    nearestSlide = slide;
                }
            } else {
                nearestSlide = slide;
                nearestDistance = distance;
            }
        })
        console.log(nearestSlide)
        if (nearestSlide) {
            nearestSlide.element.remove();
            this.slides.splice(this.slides.indexOf(nearestSlide), 1);
            this.slides.sort((a, b) => a.time - b.time);
        }
    }

    addSlideMarker(track, xPos, time) {
        const marker = document.createElement('div');
        marker.className = 'slide-marker';
        marker.style.left = `${xPos}px`;
        marker.dataset.time = time;

        const label = document.createElement('div');
        label.className = 'slide-marker-label';
        label.textContent = this.formatTime(time.toFixed());
        marker.appendChild(label);

        track.appendChild(marker);
        this.slides.push({ element: marker, time: time });
        this.slides.sort((a, b) => a.time - b.time);
        this.makeMarkerDraggable(marker);
    }

    makeMarkerDraggable(marker) {
        let isDragging = false;
        let startX = 0;
        let initialLeft = 0;

        marker.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            startX = e.clientX;
            initialLeft = parseFloat(marker.style.left);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const newLeft = Math.max(0, initialLeft + deltaX);
            marker.style.left = `${newLeft}px`;
            marker.dataset.time = (newLeft / this.pixelsPerSecond).toFixed(2);
            console.log(marker.dataset.time)
            marker.querySelector('.slide-marker-label').textContent =
                this.formatTime((newLeft / this.pixelsPerSecond).toFixed());
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            console.log(this.slides);
            this.slides.sort((a, b) => a.time - b.time);
        };
    }

    initSlideNavigation() {
        document.addEventListener('keydown', (e) => {
            this.pressedKeys[e.code] = true;
            if (!this.pressedKeys['KeyS'] && e.key === 'ArrowRight') this.nextSlide();
            if (!this.pressedKeys['KeyS'] && e.key === 'ArrowLeft') this.previousSlide();
        });
        document.addEventListener('keyup', (event) => {
            this.pressedKeys[event.code] = false; // Запоминаем, что клавиша отпущена
        });
    }

    async nextSlide() {
        if (this.currentSlideIndex < this.slides.length - 1) {
            this.currentSlideIndex++;
            await this.playCurrentSlide();
        }
    }

    async previousSlide() {
        if (this.currentSlideIndex > 0) {
            this.currentSlideIndex--;
            await this.playCurrentSlide();
        }
    }

    playCurrentSlide() {
        console.log(this.slides);
        const startTime = (this.slides[this.currentSlideIndex]?.element.dataset.time || 0);
        const endTime = this.slides[this.currentSlideIndex + 1]?.element.dataset.time || this.totalDuration;

        const container = this.createFullscreenContainer();
        console.log(startTime)

        // Запускаем воспроизведение после добавления в DOM
        this.playSequence(startTime, endTime, container);
    }

    initKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ') { // Пробел для паузы/воспроизведения
                if (this.isPlaying) {
                    if (!this.isPaused) {
                        this.pauseSequence();
                    } else {
                        this.resumeSequence();
                    }
                }
            } else if (e.key === 'Backspace') { // Escape для остановки
                this.stopSequence();
            } else if (e.key === 'f' || e.key === 'F') { // F для воспроизведения (если еще не играется)
                if (!this.isPlaying) {
                    this.playCurrentSlide();
                }
            }
        });
    }

    playSequence(startTime = 0, endTime = this.totalDuration, container) {
        this.screenSaverManager.hide();
        clearTimeout(this.screenSaverTimeout);
        this.isPlaying = true;
        this.isPaused = false;
        this.playbackStartTime = Date.now() - startTime * 1000;

        const filteredSequence = this.sequence.filter(item =>
            item.startTime >= startTime &&
            item.startTime + item.duration <= endTime
        );

        filteredSequence.forEach(item => {
            const mediaFile = window.mediaBrowser.mediaFiles.find(f => f.id == item.mediaId);
            if (!mediaFile) return;

            const delay = Math.max(0, (item.startTime - startTime) * 1000);
            const timeoutId = setTimeout(() => {
                this.playMediaElement(mediaFile, item.trackType, container); // Передаем container
                this.scheduledPlaybacks.delete(timeoutId);
            }, delay);

            this.scheduledPlaybacks.set(timeoutId, timeoutId);
        });

        const lastIndex = filteredSequence.length - 1;

        const duration = ((filteredSequence[lastIndex].startTime - startTime) + filteredSequence[lastIndex].duration) * 1000;
        console.log("Waiting " + duration.toString() + " milliseconds")
        this.screenSaverTimeout = setTimeout(() => {
            console.log("Slide ended")
            if (this.screenSaverManager?.screensavers.length > 0) {
                console.log("Showing screensaver")
                this.screenSaverManager.showCurrent();
            }
        }, duration);
    }

    pauseSequence() {
        if (this.isPlaying && !this.isPaused) {
            this.isPaused = true;
            this.pauseTime = Date.now() - this.playbackStartTime; // Запоминаем время паузы
            this.scheduledPlaybacks.forEach(timeoutId => clearTimeout(timeoutId)); // Останавливаем запланированные запуски
            this.scheduledPlaybacks.clear();

            // Ставим на паузу все медиа элементы
            document.querySelectorAll('video, audio').forEach(media => {
                media.pause();
            });

            const container = document.querySelector('.fullscreen-container');
            if (container) {
                container.classList.add('paused'); // Добавляем класс паузы для визуального эффекта
            }
        }
    }

    resumeSequence() {
        if (this.isPlaying && this.isPaused) {
            const container = document.querySelector('.fullscreen-container');
            if (container) {
                container.classList.remove('paused'); // Убираем визуальный эффект паузы
                container.remove();
            }
            this.isPaused = false;
        }
    }


    playMediaElement(mediaFile, trackType, container) {
        if (!container) {
            console.error('Playback container not found!');
            return;
        }

        // Остальной код метода без изменений
        if (trackType === 'video') {
            // Создаем контейнер для видео-слоев
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';

            // Фоновое видео с эффектами
            const bgVideo = document.createElement('video');
            bgVideo.className = 'video-bg';
            bgVideo.src = mediaFile.url;
            bgVideo.muted = true; // Фоновое видео без звука
            bgVideo.playsInline = true;

            // Основное видео
            const mainVideo = document.createElement('video');
            mainVideo.className = 'video-main';
            mainVideo.src = mediaFile.url;
            mainVideo.playsInline = true;

            // Добавляем элементы в контейнер
            videoContainer.appendChild(bgVideo);
            videoContainer.appendChild(mainVideo);
            container.appendChild(videoContainer);

            // Настройка анимаций
            const animateElements = () => {
                gsap.fromTo(videoContainer,
                    { opacity: 0, scale: 0.95 },
                    {
                        opacity: 1,
                        scale: 1,
                        duration: 0.5,
                        ease: "power2.out",
                        onComplete: () => {
                            videoContainer.style.transform = 'none';
                        }
                    }
                );

                gsap.fromTo(bgVideo,
                    { filter: 'blur(30px) brightness(1.5)' },
                    {
                        filter: 'blur(20px) brightness(1.2)',
                        duration: 1.5,
                        ease: "expo.out"
                    }
                );
            };

            // Запуск анимации при начале воспроизведения
            const playHandler = () => {
                animateElements();
                mainVideo.removeEventListener('play', playHandler);
            };

            mainVideo.addEventListener('play', playHandler);

            // Обработчик завершения видео
            mainVideo.onended = () => {
                gsap.to(videoContainer, {
                    opacity: 0,
                    scale: 0.95,
                    duration: 0.5,
                    ease: "power2.in",
                    onComplete: () => {
                        videoContainer.remove();
                    }
                });
            };

            // Запуск воспроизведения
            const playPromise = Promise.all([
                bgVideo.play().catch(console.error),
                mainVideo.play().catch(console.error)
            ]);

            // Обработка ошибок
            playPromise.catch(error => {
                console.error('Video playback failed:', error);
                videoContainer.remove();
            });
        }
        else if (trackType === 'audio') {
            const audioElement = new Audio(mediaFile.url);
            audioElement.preload = 'auto';
            audioElement.play().catch(console.error);
            audioElement.onended = () => audioElement.remove();
        }
    }

    stopSequence() {
        // Останавливаем медиа перед удалением
        document.querySelectorAll('video, audio').forEach(media => {
            media.pause();
            media.remove();
        });

        // Удаляем контейнер только если он существует
        const container = document.querySelector('.fullscreen-container');
        if (container) {
            if (document.fullscreenElement) document.exitFullscreen();
            container.remove();
        }
        this.screenSaverManager.hide();
        clearTimeout(this.screenSaverTimeout);
        this.isPlaying = false;
    }


    createFullscreenContainer() {
        // Удаляем предыдущий контейнер если существует
        const oldContainer = document.querySelector('.fullscreen-container');
        if (oldContainer) oldContainer.remove();

        // Создаем новый контейнер
        const container = document.createElement('div');
        container.className = 'fullscreen-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'black';
        document.body.appendChild(container); // Сначала добавляем в DOM

        document.body.requestFullscreen();

        return container;
    }
    initScrollHandling() {
        const timelineContainer = document.getElementById('timeline');
        const scrollableContent = timelineContainer.querySelector('.timeline-scrollable');
        const ruler = document.getElementById('timelineRuler');

        // Обработчик колеса мыши
        timelineContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            timelineContainer.scrollLeft += e.deltaY * 2;
        });

        // Обновление ширины при добавлении клипов
        const observer = new MutationObserver(() => this.updateTimelineWidth());
        observer.observe(scrollableContent, { childList: true, subtree: true });
    }

    updateTimelineWidth() {
        const scrollableContent = document.querySelector('.timeline-scrollable');
        const tracks = document.querySelectorAll('.track-content');
        const ruler = document.getElementById('timelineRuler');

        // Находим максимальную ширину
        const maxWidth = Math.max(
            ...Array.from(tracks).map(t => t.scrollWidth),
            ruler.scrollWidth
        );

        // Устанавливаем новую ширину
        scrollableContent.style.width = `${maxWidth}px`;
        tracks.forEach(t => t.style.width = `${maxWidth}px`);
        ruler.style.width = `${maxWidth}px`;
    }

    initRuler() {
        const ruler = document.getElementById('timelineRuler');
        ruler.style.width = `${this.totalDuration * this.pixelsPerSecond}px`;

        // Создаем деления временной шкалы
        for(let i = 0; i <= this.totalDuration; i++) {
            if(i % 20 === 0) { // Каждые 10 секунд
                const mark = document.createElement('div');
                mark.className = 'time-mark major';
                mark.style.left = `${i * this.pixelsPerSecond}px`;
                mark.innerHTML = `<span>${this.formatTime(i)}</span>`;
                ruler.appendChild(mark);
            }
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    initTrackDnD() {
        const tracks = document.querySelectorAll('.track');

        tracks.forEach(track => {
            track.addEventListener('dragover', e => {
                e.preventDefault();
                if (this.isValidDrop(track, e)) {
                    e.dataTransfer.dropEffect = 'copy';
                }
            });

            track.addEventListener('drop', e => {
                e.preventDefault();
                this.handleTrackDrop(track, e);
            });
        });
    }

    isValidDrop(track, event) {
        const mediaId = event.dataTransfer.getData('media/id');
        const mediaFile = window.mediaBrowser.mediaFiles.find(f => f.id == mediaId);
        if (!mediaFile) return false;

        const trackType = track.classList.contains('video-track') ? 'video' : 'audio';
        return mediaFile.type === trackType;
    }

    handleTrackDrop(track, event) {
        const mediaId = event.dataTransfer.getData('media/id');
        const mediaFile = window.mediaBrowser.mediaFiles.find(f => f.id == mediaId);
        if (!mediaFile || !this.isValidDrop(track, event)) return;

        const clip = new TimelineClip(mediaFile, mediaFile.type);
        const rect = track.getBoundingClientRect();
        const xPos = event.clientX - rect.left - 10; // 10px offset

        clip.element.style.left = `${xPos}px`;
        track.querySelector('.track-content').appendChild(clip.element); // Append to track content

        // Сохраняем связь с медиа-файлом
        clip.element.dataset.mediaId = mediaId;

        this.addToSequence(clip, track, xPos);
    }

    addToSequence(clip, track, startTimePx) {
        const mediaId = clip.element.dataset.mediaId;
        const mediaFile = window.mediaBrowser.mediaFiles.find(file => file.id == mediaId);
        const trackType = track.classList.contains('video-track') ? 'video' : 'audio';
        const startTime = startTimePx / this.pixelsPerSecond; // Convert pixels to seconds

        this.sequence.push({
            mediaId: mediaId,
            trackType: trackType,
            startTime: startTime,
            duration: mediaFile.duration,
        });
        console.log("addToSequence: startTime:", startTime, "duration:", mediaFile.duration, "для mediaId:", mediaId);
        console.log("Current Sequence:", this.sequence);
    }

    updateSequenceItemStartTime(clip, newStartTimePx) {
        const mediaId = clip.element.dataset.mediaId;
        const newStartTime = newStartTimePx / this.pixelsPerSecond;

        const sequenceItem = this.sequence.find(item => item.mediaId === mediaId);
        console.log("updateSequenceItemStartTime: newStartTimePx:", newStartTimePx, "pixelsPerSecond:", this.pixelsPerSecond, "newStartTime:", newStartTime);
        if (sequenceItem) {
            sequenceItem.startTime = newStartTime;
            console.log("Sequence updated:", this.sequence);
        }
    }
}
