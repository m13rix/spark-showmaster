class TimelineClip {
    constructor(mediaFile, trackType) {
        this.element = document.createElement('div');
        this.element.className = `timeline-clip ${trackType}-clip`;
        this.element.dataset.mediaId = mediaFile.id; // Store mediaId in dataset
        this.element.innerHTML = `
            <div class="clip-label">${mediaFile.name}</div>
            <div class="clip-duration">${this.formatDuration(mediaFile.duration)}</div>
        `;

        // Базовые стили
        this.element.style.background = trackType === 'video' ? '#4a6da7' : '#57a777';
        this.element.style.height = '60px';
        this.element.style.width = `${(mediaFile.duration * window.timeline.pixelsPerSecond) - 11}px`; // Используем pixelsPerSecond для ширины
        this.element.style.position = 'absolute';
        this.element.style.borderRadius = '4px';
        this.element.style.padding = '5px';
        this.element.style.cursor = 'grab';
        this.isDragging = false;
        this.startX = 0;
        this.initialLeft = 0;
        this.lastValidLeft = 0; // Добавляем переменную для последней допустимой позиции
        this.initClipDnD();
    }

    static SNAP_DISTANCE = 10; // Константа для дистанции прилипания

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    initClipDnD() {
        this.element.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Только левая кнопка мыши

            this.isDragging = true;
            this.startX = e.clientX;
            this.initialLeft = parseFloat(this.element.style.left) || 0;
            this.lastValidLeft = this.initialLeft; // Инициализируем последнюю допустимую позицию

            this.element.style.cursor = 'grabbing';
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        });
    }

    handleMouseMove = (e) => {
        if (!this.isDragging) return;

        const deltaX = e.clientX - this.startX;
        let newLeft = this.initialLeft + deltaX;

        // Ограничение перемещения в пределах трека
        const trackContent = this.element.parentElement;
        const maxLeft = trackContent.offsetWidth - this.element.offsetWidth;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        // Проверка прилипания
        const snapPosition = this.checkCollision(newLeft);

        if (snapPosition !== false) {
            this.element.style.left = `${snapPosition}px`;
            this.lastValidLeft = snapPosition;
        }
        else if (!this.checkCollisionForOverlap(newLeft)) {
            this.element.style.left = `${newLeft}px`;
            this.lastValidLeft = newLeft;
        } else {
            this.element.style.left = `${this.lastValidLeft}px`;
        }
    }

    handleMouseUp = () => {
        this.isDragging = false;
        this.element.style.cursor = 'grab';
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        // Обновляем данные о позиции и sequence
        const rect = this.element.getBoundingClientRect();
        const trackRect = this.element.parentElement.getBoundingClientRect();
        const relativeLeft = rect.left - trackRect.left;
        console.log(`New position: ${relativeLeft}px`);
        console.log("handleMouseUp: relativeLeft:", relativeLeft, "pixelsPerSecond:", window.timeline.pixelsPerSecond, "startTime:", relativeLeft / window.timeline.pixelsPerSecond);

        window.timeline.updateSequenceItemStartTime(this, relativeLeft); // Обновляем startTime в sequence
    }


    checkCollision(potentialLeft) {
        const trackContent = this.element.parentElement;
        const currentTrack = trackContent.closest('.track');
        const currentTrackType = currentTrack.classList.contains('video-track') ? 'video' : 'audio';

        const snapElements = [];
        const oppositeType = currentTrackType === 'video' ? 'audio' : 'video';

        // Собираем элементы с учетом смещения для противоположных треков
        document.querySelectorAll('.timeline-clip, .slide-marker').forEach(element => {
            const elementTrack = element.closest('.track');
            const elementTrackType = elementTrack?.classList.contains('video-track') ? 'video' : 'audio';

            // Добавляем смещение только для клипов из противоположных треков
            const isOpposite = elementTrackType === oppositeType && element.classList.contains('timeline-clip');
            element.snapOffset = isOpposite ? 1.8 : 0; // Сохраняем смещение в свойстве элемента

            snapElements.push(element);
        });

        const thisClip = {
            left: potentialLeft,
            right: potentialLeft + this.element.offsetWidth,
            width: this.element.offsetWidth
        };

        let bestSnap = null;
        let minDistance = TimelineClip.SNAP_DISTANCE;

        snapElements.forEach(element => {
            if (element === this.element) return;

            const elementLeft = parseFloat(element.style.left) || 0;
            const elementWidth = element.offsetWidth;
            const elementRight = elementLeft + elementWidth;
            const offset = element.snapOffset || 0; // Получаем сохраненное смещение

            // Точки прилипания с учетом смещения
            const snapPoints = [
                elementLeft + offset,     // Левый край + смещение
                elementRight + offset,    // Правый край + смещение
                elementLeft - thisClip.width + offset,
                elementRight - thisClip.width + offset
            ];

            // Для слайдов используем оригинальную позицию
            if (element.classList.contains('slide-marker')) {
                snapPoints.push(elementLeft);
            }

            snapPoints.forEach(point => {
                // Рассчитываем расстояние для обоих краев клипа
                const leftDistance = Math.abs(thisClip.left - point);
                const rightDistance = Math.abs(thisClip.right - point);
                const distance = Math.min(leftDistance, rightDistance);

                if (distance < minDistance) {
                    minDistance = distance;
                    bestSnap = point;

                    // Корректируем позицию в зависимости от того, какая грань ближе
                    bestSnap = leftDistance < rightDistance
                        ? point
                        : point - thisClip.width;
                }
            });
        });

        // Дополнительная проверка границ трека
        if (bestSnap !== null) {
            const maxLeft = trackContent.offsetWidth - this.element.offsetWidth;
            bestSnap = Math.max(0, Math.min(bestSnap, maxLeft));
        }

        // Визуальная обратная связь
        this.updateSnapIndicators(bestSnap, snapElements);

        return bestSnap !== null ? bestSnap : false;
    }

// Новый метод для обновления индикаторов прилипания
    updateSnapIndicators(snapPosition, elements) {
        elements.forEach(element => {
            element.classList.remove('snap-highlight');

            if (snapPosition === null) return;

            const elementLeft = parseFloat(element.style.left) || 0;
            const elementRight = elementLeft + element.offsetWidth;
            const offset = element.snapOffset || 0;

            // Проверяем совпадение с учетом смещения
            if (Math.abs(elementLeft + offset - snapPosition) < 2 ||
                Math.abs(elementRight + offset - snapPosition) < 2) {
                element.classList.add('snap-highlight');
            }
        });
    }

    getElementTimelinePosition(element) {
        const trackContent = element.parentElement;
        const timelineScrollable = document.querySelector('.timeline-scrollable');
        return trackContent.offsetLeft + parseFloat(element.style.left);
    }


    checkCollisionForOverlap(potentialLeft) { // Отдельная функция для проверки именно перекрытия
        const trackContent = this.element.parentElement;
        const clips = trackContent.querySelectorAll('.timeline-clip');
        let collision = false;

        const thisClipRect = {
            left: potentialLeft,
            right: potentialLeft + this.element.offsetWidth
        };

        clips.forEach(clip => {
            if (clip === this.element) return; // Не проверяем столкновение с самим собой

            const clipRect = {
                left: parseFloat(clip.style.left) || 0,
                right: (parseFloat(clip.style.left) || 0) + clip.offsetWidth
            };

            if (thisClipRect.left < clipRect.right && thisClipRect.right > clipRect.left) {
                collision = true;
            }
        });

        return collision;
    }
}
