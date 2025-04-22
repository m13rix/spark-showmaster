const express = require('express');
const cors = require('cors');
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const {
    GoogleGenAI,
} =  require('@google/genai');
const Together = require("together-ai");
const path = require("path");
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public',)));
// Создаем папки для хранения изображений
const uploadDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware для раздачи статических файлов
app.use('/image', express.static(uploadDir));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });

const ArtModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "Ты профессиональный художник-дизайнер и лингвист, специализирующийся на создании креативных промптов для генерации изображений. Твоя задача — преобразовать запросы на русском языке в детальные, художественно-ориентированные промпты на английском для нейросети Flux, учитывая технические ограничения (маленький экран) и стилистику StageMaster.  \n\n**Правила генерации:**  \n1. **Стиль:**  \n   - Всегда предлагай абстрактные, минималистичные или иллюстративные стили (акварель, масляные мазки, цифровая живопись, геометрический арт, световые эффекты).  \n   - Избегай фотореализма. Упор на \"волшебство\", эмоции, метафоры (например, \"свечение нот на тёмном фоне\", \"танцующие мазки цвета\").  \n   - Если тема нейтральная, добавь элементы сюрреализма или фантазии (например, для \"школа\" → \"парта в облаках с летающими мелками\").  \n\n2. **Оптимизация под экран:**  \n   - Акцентируй крупные элементы, контрастные цвета, плавные градиенты.  \n   - Избегай мелких деталей, текста, лиц.  \n   - Фокус на центре композиции.  \n\n3. **Структура промпта для Flux:**  \n   - Начни с «Create an artistic illustration in [стиль] style...».  \n   - Добавь эмоцию/настроение (e.g., «calm», «dynamic», «mysterious»).  \n   - Укажи цветовую палитру (e.g., «pastel tones with neon accents»).  \n   - Включи оптимизацию: «simplified shapes, minimal details, suitable for small screens».  \n\n**Примеры преобразования:**  \n- Запрос: «Осенний концерт»  \n- Промпт: «Create an artistic illustration in watercolor style, autumn leaves transforming into musical notes, warm golden and burgundy palette, soft blurred background, minimal details, emotional and magical atmosphere, suitable for small screens».  \n\n- Запрос: «Технологии будущего»  \n- Промпт: «Abstract digital painting of floating geometric shapes in neon blue and purple, glowing particles, cyberpunk vibe, dark background with gradient light, dynamic and futuristic, simplified composition for displays».  \n\n**Действуй шагами:**  \n1. Пойми контекст запроса (тема концерта, возраст детей, жанр музыки).  \n2. Предложи 2 варианта стиля на выбор (если не указан).  \n3. Сгенерируй промпт, следуя правилам выше.  \n4. Напиши короткое пояснение на русском, почему выбран стиль и цвета.»  \n\n**Дополнительно:**  \n- Для детских концертов добавляй игривые элементы (мультяшные звёзды, волны, животные-инструменты).  \n- Для классической музыки используй барокко, абстракцию с золотыми акцентами.  \n- Всегда избегай тёмных/агрессивных тонов, если не запрошено иное.  \n- Избигайте людей и текст, даже примитивные силуеты\n- В своём ответе ПИШИ ТОЛЬКО ГОТОВЫЙ ПРОМПТ, БЕЗ ДОПОЛНИТЕЛЬНЫХ КОММЕНТАРИЕМ И т.п.",
});

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;

        // Генерация промпта через Gemini
        const chatSession = ArtModel.startChat({
            generationConfig: {
                temperature: 1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: "text/plain",
            },
        });

        const geminiResponse = await chatSession.sendMessage(
            `Сгенерируй промпт для изображения: ${prompt}`
        );

        // Генерация изображения через FLUX
        const fluxResponse = await together.images.create({
            model: "black-forest-labs/FLUX.1-schnell",
            prompt: geminiResponse.response.text(),
            width: 1024,
            height: 768,
            steps: 4,
            n: 1,
            response_format: "base64"
        });

        res.json({
            success: true,
            image: fluxResponse.data[0].b64_json
        });

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка генерации изображения'
        });
    }
});

function extractJSON(str) {
    const openBrackets = ['{', '['];
    const closeBrackets = ['}', ']'];

    // Ищем первую открывающую скобку
    let startIndex = -1;
    for (let i = 0; i < str.length; i++) {
        if (openBrackets.includes(str[i])) {
            startIndex = i;
            break;
        }
    }

    if (startIndex === -1) return null;

    const stack = [];
    let inString = false;
    let escape = false;
    let endIndex = startIndex;
    const targetBracket = closeBrackets[openBrackets.indexOf(str[startIndex])];

    for (let i = startIndex; i < str.length; i++) {
        const char = str[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === openBrackets[0] || char === openBrackets[1]) {
                stack.push(char);
            }
            else if (char === closeBrackets[0] || char === closeBrackets[1]) {
                stack.pop();
                if (stack.length === 0 && char === targetBracket) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }

    try {
        return JSON.parse(str.slice(startIndex, endIndex));
    } catch (e) {
        return null;
    }
}

// Функция обработки изображения
async function processImage(base64Data) {
    try {
        const buffer = Buffer.from(base64Data, 'base64');

        // Первый этап: Создание маски фона
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const height = info.height;
        const visited = new Array(width * height).fill(false);
        const queue = [];

        // Пороговые значения для определения белого цвета
        const isBackground = (r, g, b) => r > 240 && g > 240 && b > 240;

        // Инициализация очереди с краев изображения
        for (let y = 0; y < height; y++) {
            for (let x of [0, width - 1]) {
                const idx = (y * width + x) * 4;
                if (isBackground(data[idx], data[idx+1], data[idx+2])) {
                    queue.push([x, y]);
                    visited[y * width + x] = true;
                }
            }
        }

        for (let x = 0; x < width; x++) {
            for (let y of [0, height - 1]) {
                const idx = (y * width + x) * 4;
                if (isBackground(data[idx], data[idx+1], data[idx+2])) {
                    queue.push([x, y]);
                    visited[y * width + x] = true;
                }
            }
        }

        // Flood fill алгоритм
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        while (queue.length > 0) {
            const [x, y] = queue.shift();

            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const idx = (ny * width + nx) * 4;
                    if (!visited[ny * width + nx] && isBackground(data[idx], data[idx+1], data[idx+2])) {
                        visited[ny * width + nx] = true;
                        queue.push([nx, ny]);
                    }
                }
            }
        }

        // Второй этап: Применение маски
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (visited[y * width + x]) {
                    data[idx + 3] = 0; // Устанавливаем прозрачность для фона
                }
            }
        }

        // Третий этап: Обрезка и сохранение
        return sharp(Buffer.from(data), {
            raw: {
                width: width,
                height: height,
                channels: 4
            }
        })
            .png()
            .trim({ threshold: 5, background: 'transparent' })
            .toBuffer();

    } catch (error) {
        throw error;
    }
}

async function invokeMainModel(prompt) {
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });
    const config = {
        responseMimeType: 'text/plain',
        thinkingConfig: { includeThoughts: false },
        temperature: 0
    };
    const model = 'gemini-2.5-flash-preview-04-17';
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: "# РОЛЬ:\nТы - эксперт по Minecraft Bukkit плагинам и Nashorn JavaScript, специализирующийся на создании **максимально простого, но функционального и работоспособного** кода, особенно для таких моделей, как Gemini 2.5 Flash, которые могут испытывать трудности со сложными задачами. Твоя главная цель - **качество и работоспособность** генерируемого кода.\n\n# ЗАДАЧА:\nСоздай кастомный предмет в Minecraft согласно запросу пользователя. Ты должен сгенерировать:\n1.  **JSON-конфигурацию** предмета в СТРОГО заданном формате.\n2.  **Nashorn JavaScript скрипты** для указанных событий, придерживаясь ИСКЛЮЧИТЕЛЬНО предоставленных инструкций и ограничений.\n\n# ЗАПРОС ПОЛЬЗОВАТЕЛЯ:\n\"" + prompt + "\".\n\n# КЛЮЧЕВЫЕ ТРЕБОВАНИЯ И ОГРАНИЧЕНИЯ (СТРОГО СОБЛЮДАТЬ!):\n1.  **МАКСИМАЛЬНАЯ ПРОСТОТА КОДА:** Nashorn имеет много ограничений. Используй только базовые конструкции JavaScript и прямые вызовы Bukkit API из инструкции. Избегай сложной логики, вложенных функций, замыканий, продвинутых возможностей Java или JS, которые могут не поддерживаться или работать нестабильно в Nashorn. Код должен быть ЛИНЕЙНЫМ и ЧИТАЕМЫМ насколько это возможно. Это КРИТИЧЕСКИ важно для работоспособности на целевой платформе и модели ИИ.\n2.  **РАБОТОСПОСОБНОСТЬ ПРЕВЫШЕ ВСЕГО:** Генерируй только тот код, в работоспособности которого ты уверен в контексте Nashorn и Bukkit API. Если сомневаешься, выбирай более простой и надежный путь.\n3.  **БЕЗ УСЛОЖНЕНИЙ:** НЕ добавляй никаких кулдаунов, систем перезарядки, расхода патронов или любых других механик, усложняющих скрипт, если это явно не запрошено (в данном запросе этого НЕТ).\n4.  **ЭФФЕКТЫ:** Добавляй звуки и частицы для улучшения эффекта выстрела, как просит пользователь.\n5.  **ЧАСТИЦЫ:** НЕ ИСПОЛЬЗУЙ ЧАСТИЦЫ REDSTONE ОТ СЛОВА СОВСЕМ, так как они могут не работать в контексте плагина пользователя.\n6.  **ОШИБКИ В СКРИПТЕ:** Используй конструкцию `try-catch` для обработки возможных ошибок *во время выполнения* скрипта в игре. Внутри блока `catch` **ОБЯЗАТЕЛЬНО ВЫВОДИ ОШИБКИ ЧЕРЕЗ** `player.sendMessage()` или любые другие способы вывода сообщения об ошибке игроку в чат. При этом сам генерируемый тобой код **не должен содержать синтаксических ошибок**.\n7.  **БЕЗ ПЛЕЙСХОЛДЕРОВ:** Весь код и JSON должны быть полностью готовыми к использованию. НЕ используй комментарии вроде `\/\/ ваш код здесь` или `<заполните_значение>`.\n8.  **СТРОГОЕ ФОРМАТИРОВАНИЕ JSON:** Выходные данные должны быть ЕДИНЫМ JSON объектом, точно соответствующим приведенной ниже структуре. Не добавляй никаких пояснений вне JSON, кроме как по прямому запросу.\n\n# ФОРМАТ ВЫВОДА JSON (ОБЯЗАТЕЛЕН):\n```json\n{\n  \"name\": \"НАЗВАНИЕ_ПРЕДМЕТА\",\n  \"lore\": \"ОПИСАНИЕ_ПРЕДМЕТА\",\n  \"base\": \"ТИП_ОСНОВЫ\",\n  \"texture\": \"ПРОСТОЕ_ОПИСАНИЕ_ТЕКСТУРЫ_НА_АНГЛИЙСКОМ\", \/\/ Только для base: custom\n  \"two_handed\": true\/false, \/\/ Только для base: custom\n  \"attack_damage\": ЧИСЛО,\n  \"attack_knockback\": ЧИСЛО,\n  \"mining_speed\": ЧИСЛО,\n  \"armor\": ЧИСЛО,\n  \"armor_toughness\": ЧИСЛО,\n  \"scripts\": {\n    \"LeftClick\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"RightClick\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"RightClickBlock\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"BlockBroken\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"ProjectileLanded\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\", \/\/ Только для base: bow\/crossbow\n    \"ProjectileHit\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\", \/\/ Только для base: bow\/crossbow\n    \"EntityHit\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"OwenerHit\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"Tick\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\" \/\/ НЕ РЕКОМЕНДУЕТСЯ СЛОЖНАЯ ЛОГИКА\n  }\n}\n```\n\n# ИНСТРУКЦИЯ ПО НАПИСАНИЮ NASHORN СКРИПТОВ (ОБЯЗАТЕЛЬНА К ИСПОЛНЕНИЮ):\n\n*   **Язык:** JavaScript, совместимый с Nashorn (Java 8+).\n*   **Формат:** Весь код для одного события должен быть ОДНОЙ строкой JavaScript, где переносы строк заменены на `\\n`. Эта строка присваивается соответствующему ключу в объекте `scripts`.\n*   **Доступные объекты:**\n    *   `event`: Объект события Bukkit (тип зависит от ключа: `PlayerInteractEvent` для `LeftClick`\/`RightClick`\/`RightClickBlock`, `BlockBreakEvent` для `BlockBroken`, и т.д.).\n    *   `player` (только для `Tick`): Прямая ссылка на игрока `org.bukkit.entity.Player`.\n    *   `plugin`: Объект вашего плагина (используй осторожно, специфичные методы могут отсутствовать).\n*   **Использование Java:**\n    *   Импорт классов: `var ИмяКласса = Java.type(\"полное.имя.класса\");` (Пример: `var Bukkit = Java.type(\"org.bukkit.Bukkit\");`). Импортируй ТОЛЬКО необходимые классы в начале скрипта.\n    *   Создание объектов: `new ИмяКласса(параметры);` (Пример: `var ItemStack = Java.type(\"org.bukkit.inventory.ItemStack\"); var Material = Java.type(\"org.bukkit.Material\"); var item = new ItemStack(Material.DIAMOND, 1);`).\n*   **Работа с событием `event`:**\n    *   Получить игрока: `event.getPlayer()` (если применимо к событию).\n    *   Получить мир: `player.getWorld()`.\n    *   Получить локацию игрока: `player.getLocation()`.\n    *   Получить направление взгляда: `player.getLocation().getDirection()`.\n    *   Получить сущностей рядом: `player.getNearbyEntities(x, y, z)`.\n    *   Получить блок (если применимо): `event.getClickedBlock()`.\n    *   Отмена события: `event.setCancelled(true);`.\n*   **ВАЖНО - Проверка предмета:** В начале скриптов событий (`LeftClick`, `RightClick` и т.д.), **всегда** проверяй, что игрок держит именно *твой* кастомный предмет в руке (`event.getPlayer().getInventory().getItemInMainHand()`), сравнивая его название (`getDisplayName()`) или другие уникальные метаданные, если они есть. Это предотвратит срабатывание скрипта с другими предметами.\n*   **Java <-> JavaScript:**\n    *   JS массив в Java массив: `Java.to(jsArray, \"тип[]\");` (Пример: `Java.to([1, 2, 3], \"int[]\");`). Используй только при необходимости.\n    *   Расширение Java классов: `Java.extend(Java.type(\"...\"), { методы });`. ИСПОЛЬЗУЙ КРАЙНЕ ОСТОРОЖНО И ТОЛЬКО ЕСЛИ НЕТ ДРУГОГО ВЫХОДА, это усложняет код.\n*   **Обработка ошибок:** Оборачивай основной код скрипта в `try { ... } catch (e) { \/* НЕ ВЫВОДИТЬ ОШИБКУ ИГРОКУ *\/ }`.\n\n# ПРИМЕР ЖЕЛАЕМОГО ВЫВОДА (ТОЛЬКО СТРУКТУРА И СТИЛЬ):\n```json\n{\n  \"name\": \"Пример Название\",\n  \"lore\": \"Пример Описание\",\n  \"base\": \"custom\",\n \"texture\": \"shotgun\",\n  \/\/ ... другие параметры ...\n  \"scripts\": {\n    \"LeftClick\": \"var Player = Java.type('org.bukkit.entity.Player');\\nvar Sound = Java.type('org.bukkit.Sound');\\ntry {\\n    var player = event.getPlayer();\\n    \/\/ Проверка предмета в руке\\n    var item = player.getInventory().getItemInMainHand();\\n    if (item != null && item.hasItemMeta() && item.getItemMeta().hasDisplayName() && item.getItemMeta().getDisplayName().contains('Пример Название')) {\\n        \/\/ Простой код действия\\n        player.getWorld().playSound(player.getLocation(), Sound.ENTITY_PLAYER_ATTACK_SWEEP, 1.0, 1.0);\\n        \/\/ event.setCancelled(true); \/\/ Если нужно отменить стандартное действие\\n    }\\n} catch (e) {\\n    player.sendMessage(\"Ошибка: \" + e.message);\\n}\",\n    \"RightClick\": \"\" \/\/ Оставляй пустым, если не используется\n    \/\/ ... другие события ...\n  }\n}\n```\n\nТеперь приступай к выполнению запроса пользователя, строго следуя ВСЕМ инструкциям и ограничениям. Сконцентрируйся на простоте и работоспособности.\n```",
                },
            ],
        },
    ];

    const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
    });
    let resultText = ""

    for await (const chunk of response) {
        const content = chunk.text;
        // Выводим текст по мере поступления
        process.stdout.write(content);
        resultText += content;
    }

    return resultText;
}

async function checkItems(prompt = "", items = "нет предметов") {
    const response = await fetch("https://llm.chutes.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": "Bearer cpk_16161538d18f4e00ac614ec0f4b611cc.371b46a22fbb5822a666c0725570ec5e.0DY2VG7rK1UQZj9lllGa1u3CTNGph93O",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "deepseek-ai/DeepSeek-V3-0324",
            "messages": [
                {
                    "role": "user",
                    "content": "Ты — гибкий помощник для крафта в Minecraft-модификации. Игрок передаёт список своих предметов и текстовое описание рецепта. Твоя задача — **одобрять крафт, если рецепт логичен и сбалансирован**, даже если есть незначительные расхождения. Правила:\n\n1. **Логика важнее точности**: Если рецепт имеет смысл (например, алмазы для прочного предмета) — одобряй, даже если ресурсов чуть меньше требуемого. Допускай недостачу до 20% для дешёвых ресурсов и до 50% для редких (алмазы, древние обломки).\n2. **Упрощённые этапы**: Промежуточные крафты считаются автоматически. Если игрок имеет базовые ресурсы для этапов — считай, что он их уже создал (например, сталь = железо + уголь, даже если её нет в инвентаре).\n3. **Баланс через ценность ресурсов**: Дорогие/редкие предметы (алмаз, нэзеровые слитки) считаются «валютой». Если игрок вложил их в рецепт — крафт почти всегда одобряется (например, 5 алмазов вместо 10 для мега-кирки).\n4. **Ошибки только для явного дисбаланса**: Отклоняй крафт, только если не хватает ключевых элементов (нет пороха для динамита) или количество базовых ресурсов меньше 50% от требуемого.\n\nПример одобрения:\n{\"Success\": true}\n\nПример отказа:\n{\n  \"Success\": false,\n  \"Error\": \"Для крафта ракеты нужен Порох (минимум 3), Алмазный блок (хотя бы 1)\"\n}\n\nСейчас игрок хочет создать: " + prompt + ". Его инвентарь: " + items + "."
                }
            ],
            "stream": true,
            "max_tokens": 1024,
            "temperature": 1
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n');
        buffer = chunks.pop();

        for (const chunk of chunks) {
            const trimmedChunk = chunk.trim();
            if (!trimmedChunk) continue;

            if (trimmedChunk === 'data: [DONE]') {
                console.log('\nStream completed');
                return resultText;
            }

            try {
                if (trimmedChunk.startsWith('data: ')) {
                    const json = JSON.parse(trimmedChunk.slice(6));
                    const content = json.choices[0]?.delta?.content || '';

                    // Выводим текст по мере поступления
                    resultText += content;
                }
            } catch (err) {
                console.error('Error parsing chunk:', err);
            }
        }
    }

    return resultText;
}

async function generateTexture(prompt = "", twoHanded = false){
    let finalPrompt = "Pixel art of a detailed " + prompt + ", centered on a pure white background. detailed in 8-bit or 16-bit style, no shadows";
    if (twoHanded) finalPrompt = "a centered, a " + prompt + " pointing forward, viewed from a first-person perspective. No hands or characters visible. Clean white background. High-resolution sprite suitable for game development. Pixelated"
    // Генерация изображения через FLUX
    const fluxResponse = await together.images.create({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: finalPrompt,
        width: 1024,
        height: 768,
        steps: 4,
        n: 1,
        response_format: "base64"
    });

    const base64Data = fluxResponse.data[0].b64_json;

    // Обработка изображения
    const processedImage = await processImage(base64Data);

    // Сохранение файла
    const imageId = uuidv4();
    const filename = `${imageId}.png`;
    await sharp(processedImage).toFile(path.join(uploadDir, filename));

    // Генерация короткой ссылки
    const shortUrl = `https://stagemaster.up.railway.app/image/${filename}`;
    console.log(shortUrl)
    return shortUrl;
}

app.post('/api/generate-item', async (req, res) => {
    try {
        const { prompt, items } = req.body;
        console.log(prompt)

        //const initialResponse = await checkItems(prompt, items);
        //console.log("Response:" + initialResponse)

        //const isBalanced = extractJSON(initialResponse);
        let responseJson;

        //initialResponse["Success"] ===
        if (true) {
            const mainResponse = await invokeMainModel(prompt)
            console.log(mainResponse)

            responseJson = extractJSON(mainResponse);
            console.log(responseJson)
            if (responseJson["base"] === "custom") {
                const textureUrl = await generateTexture(responseJson["texture"], responseJson["two_handed"]);
                responseJson["texture"] = textureUrl;
            }
        } else {
            responseJson = isBalanced;
        }

        console.log(responseJson);

        res.json(responseJson);

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка генерации изображения'
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
