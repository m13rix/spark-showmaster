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
const together = new Together({ apiKey: "bcb2dfeb195a68c76a53d8b682a21609ad69de7b16335125cfd3d9342b19eb37" });
const geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

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

// Универсальный генератор текста через новый SDK @google/genai
async function geminiGenerateText(contents, temperature = 0.7, model = 'gemini-2.5-flash') {
    const config = {
        responseMimeType: 'text/plain',
        thinkingConfig: { includeThoughts: false },
        temperature: temperature
    };

    const response = await geminiClient.models.generateContentStream({
        model,
        config,
        contents,
    });

    let resultText = "";
    for await (const chunk of response) {
        const content = chunk.text;
        if (content) {
            resultText += content;
        }
    }
    return resultText;
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
    const model = 'gemini-2.5-flash';
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: "# РОЛЬ:\nТы - эксперт по Minecraft Bukkit плагинам и Nashorn JavaScript, специализирующийся на создании **максимально простого, но функционального и работоспособного** кода, особенно для таких моделей, как Gemini 2.5 Flash, которые могут испытывать трудности со сложными задачами. Твоя главная цель - **качество и работоспособность** генерируемого кода.\n\n# ЗАДАЧА:\nСоздай кастомный предмет в Minecraft согласно запросу пользователя. Ты должен сгенерировать:\n1.  **JSON-конфигурацию** предмета в СТРОГО заданном формате.\n2.  **Nashorn JavaScript скрипты** для указанных событий, придерживаясь ИСКЛЮЧИТЕЛЬНО предоставленных инструкций и ограничений.\n\n# ЗАПРОС ПОЛЬЗОВАТЕЛЯ:\n\"" + prompt + "\".\n\n# КЛЮЧЕВЫЕ ТРЕБОВАНИЯ И ОГРАНИЧЕНИЯ (СТРОГО СОБЛЮДАТЬ!):\n1.  **МАКСИМАЛЬНАЯ ПРОСТОТА КОДА:** Nashorn имеет много ограничений. Используй только базовые конструкции JavaScript и прямые вызовы Bukkit API из инструкции. Избегай сложной логики, вложенных функций, замыканий, продвинутых возможностей Java или JS, которые могут не поддерживаться или работать нестабильно в Nashorn. Код должен быть ЛИНЕЙНЫМ и ЧИТАЕМЫМ насколько это возможно. Это КРИТИЧЕСКИ важно для работоспособности на целевой платформе и модели ИИ.\n2.  **РАБОТОСПОСОБНОСТЬ ПРЕВЫШЕ ВСЕГО:** Генерируй только тот код, в работоспособности которого ты уверен в контексте Nashorn и Bukkit API. Если сомневаешься, выбирай более простой и надежный путь.\n3.  **БЕЗ УСЛОЖНЕНИЙ:** НЕ добавляй никаких кулдаунов, систем перезарядки, расхода патронов или любых других механик, усложняющих скрипт, если это явно не запрошено (в данном запросе этого НЕТ).\n4.  **ЭФФЕКТЫ:** Добавляй звуки и частицы для улучшения эффекта выстрела, как просит пользователь.\n5.  **ЧАСТИЦЫ:** НЕ ИСПОЛЬЗУЙ ЧАСТИЦЫ REDSTONE ОТ СЛОВА СОВСЕМ, так как они могут не работать в контексте плагина пользователя. ВОТ ВСЕ ОСТАЛЬНЫЕ ЧАСТИЦЫ, КОТОРЫЕ ВЫ МОЖЕТЕ ИСПОЛЬЗОВАТЬ (те, которых нет в этом списке НЕ ИСПОЛЬЗУЙТЕ:): ANGRY_VILLAGER\\n \\nASH\\n \\nBLOCK\\nUses BlockData as DataType\\nBLOCK_CRUMBLE\\nUses BlockData as DataType\\nBLOCK_MARKER\\nUses BlockData as DataType\\nBUBBLE\\n \\nBUBBLE_COLUMN_UP\\n \\nBUBBLE_POP\\n \\nCAMPFIRE_COSY_SMOKE\\n \\nCAMPFIRE_SIGNAL_SMOKE\\n \\nCHERRY_LEAVES\\n \\nCLOUD\\n \\nCOMPOSTER\\n \\nCRIMSON_SPORE\\n \\nCRIT\\n \\nCURRENT_DOWN\\n \\nDAMAGE_INDICATOR\\n \\nDOLPHIN\\n \\nDRAGON_BREATH\\n \\nDRIPPING_DRIPSTONE_LAVA\\n \\nDRIPPING_DRIPSTONE_WATER\\n \\nDRIPPING_HONEY\\n \\nDRIPPING_LAVA\\n \\nDRIPPING_OBSIDIAN_TEAR\\n \\nDRIPPING_WATER\\n \\nDUST\\nUses Particle.DustOptions as DataType\\nDUST_COLOR_TRANSITION\\nUses Particle.DustTransition as DataType\\nDUST_PILLAR\\nUses BlockData as DataType\\nDUST_PLUME\\n \\nEFFECT\\n \\nEGG_CRACK\\n \\nELDER_GUARDIAN\\n \\nELECTRIC_SPARK\\n \\nENCHANT\\n \\nENCHANTED_HIT\\n \\nEND_ROD\\n \\nENTITY_EFFECT\\nUses Color as DataType\\nEXPLOSION\\n \\nEXPLOSION_EMITTER\\n \\nFALLING_DRIPSTONE_LAVA\\n \\nFALLING_DRIPSTONE_WATER\\n \\nFALLING_DUST\\nUses BlockData as DataType\\nFALLING_HONEY\\n \\nFALLING_LAVA\\n \\nFALLING_NECTAR\\n \\nFALLING_OBSIDIAN_TEAR\\n \\nFALLING_SPORE_BLOSSOM\\n \\nFALLING_WATER\\n \\nFIREFLY\\n \\nFIREWORK\\n \\nFISHING\\n \\nFLAME\\n \\nFLASH\\n \\nGLOW\\n \\nGLOW_SQUID_INK\\n \\nGUST\\n \\nGUST_EMITTER_LARGE\\n \\nGUST_EMITTER_SMALL\\n \\nHAPPY_VILLAGER\\n \\nHEART\\n \\nINFESTED\\n \\nINSTANT_EFFECT\\n \\nITEM\\nUses ItemStack as DataType\\nITEM_COBWEB\\n \\nITEM_SLIME\\n \\nITEM_SNOWBALL\\n \\nLANDING_HONEY\\n \\nLANDING_LAVA\\n \\nLANDING_OBSIDIAN_TEAR\\n \\nLARGE_SMOKE\\n \\nLAVA\\n \\nMYCELIUM\\n \\nNAUTILUS\\n \\nNOTE\\n \\nOMINOUS_SPAWNING\\n \\nPALE_OAK_LEAVES\\n \\nPOOF\\n \\nPORTAL\\n \\nRAID_OMEN\\n \\nRAIN\\n \\nREVERSE_PORTAL\\n \\nSCRAPE\\n \\nSCULK_CHARGE\\nUse Float as DataType\\nSCULK_CHARGE_POP\\n \\nSCULK_SOUL\\n \\nSHRIEK\\nUse Integer as DataType\\nSMALL_FLAME\\n \\nSMALL_GUST\\n \\nSMOKE\\n \\nSNEEZE\\n \\nSNOWFLAKE\\n \\nSONIC_BOOM\\n \\nSOUL\\n \\nSOUL_FIRE_FLAME\\n \\nSPIT\\n \\nSPLASH\\n \\nSPORE_BLOSSOM_AIR\\n \\nSQUID_INK\\n \\nSWEEP_ATTACK\\n \\nTINTED_LEAVES\\nUses Color as DataType\\nTOTEM_OF_UNDYING\\n \\nTRAIL\\nUses Particle.Trail as DataType\\nTRIAL_OMEN\\n \\nTRIAL_SPAWNER_DETECTION\\n \\nTRIAL_SPAWNER_DETECTION_OMINOUS\\n \\nUNDERWATER\\n \\nVAULT_CONNECTION\\n \\nVIBRATION\\nUses Vibration as DataType\\nWARPED_SPORE\\n \\nWAX_OFF\\n \\nWAX_ON\\n \\nWHITE_ASH\\n \\nWHITE_SMOKE\\n \\nWITCH \n6.  **ОШИБКИ В СКРИПТЕ:** Используй конструкцию `try-catch` для обработки возможных ошибок *во время выполнения* скрипта в игре. Внутри блока `catch` **ОБЯЗАТЕЛЬНО ВЫВОДИ ОШИБКУ ЧЕРЕЗ** `player.sendMessage()` или любые другие способы вывода сообщения об ошибке игроку в чат. При этом сам генерируемый тобой код **не должен содержать синтаксических ошибок**.\n7.  **БЕЗ ПЛЕЙСХОЛДЕРОВ:** Весь код и JSON должны быть полностью готовыми к использованию. НЕ используй комментарии вроде `\/\/ ваш код здесь` или `<заполните_значение>`.\n8.  **СТРОГОЕ ФОРМАТИРОВАНИЕ JSON:** Выходные данные должны быть ЕДИНЫМ JSON объектом, точно соответствующим приведенной ниже структуре. Не добавляй никаких пояснений вне JSON, кроме как по прямому запросу.\n9. **ЧЁТКОЕ ИСПОЛЬЗОВАНИЕ ОПРЕДЕЛЁННЫХ ФУНКЦИЙ** Из-за специфики Nashorn, некоторые функции не пишутся так как в обычном плагине, например: ВЗРЫВЫ: \"var FloatType = Java.type('java.lang.Float'); world.createExplosion(location, new FloatType(10.0), true, true);\" Если Java-метод ожидает тип double или float, всегда используй в JavaScript числовые литералы с десятичной точкой (например, 10.0, 0.5) или явно создавай нужный тип (например, new FloatType(25.0) для float). Это нужно, чтобы избежать ошибок несоответствия сигнатур. !! Например: world.spawnParticle(Particle.CLOUD, location, 200, 15.0, 15.0, 15.0, 0.5); Также обращай внимание на конструкторы Java-классов (например, new Vector(...)). Если у конструктора есть перегрузки с разными числовыми типами (например, (int, int, int) и (double, double, double)), убедись, что все передаваемые аргументы имеют единообразный тип, соответствующий одной из сигнатур. При смешивании целочисленных литералов (как 0) и литералов с плавающей точкой (как 1.0) в одном вызове возникнет ошибка неоднозначности. Предпочитай использовать числа с десятичной точкой (например, 0.0, 1.0, 0.0), чтобы явно выбрать версию с double, если не требуется строго целочисленная версия. - При использовании Java.extend в Nashorn для реализации Java-интерфейсов (например, Runnable) или классов, помни, что Java.extend(Тип) возвращает конструктор. Не используй new Java.extend(...). Правильный шаблон:\\n\\n    var ImplConstructor = Java.extend(JavaType);\\n\\n    var instance = new ImplConstructor({ \\/* реализации методов *\\/ });\\n    Пожалуйста, используй этот шаблон при генерации кода с Java.extend. \n\n# ФОРМАТ ВЫВОДА JSON (ОБЯЗАТЕЛЕН):\n```json\n{\n  \"name\": \"НАЗВАНИЕ_ПРЕДМЕТА\",\n  \"lore\": \"ОПИСАНИЕ_ПРЕДМЕТА В ОДНОЙ СТРОКЕ\",\n  \"base\": \"ТИП_ОСНОВЫ\",\n  \"texture\": \"ПРОСТОЕ_ОПИСАНИЕ_ТЕКСТУРЫ_НА_АНГЛИЙСКОМ\", \/\/ Только для base: custom\n  \"two_handed\": true\/false, \/\/ Только для base: custom\n  \"attack_damage\": ЧИСЛО,\n  \"attack_knockback\": ЧИСЛО,\n  \"mining_speed\": ЧИСЛО,\n  \"armor\": ЧИСЛО,\n  \"armor_toughness\": ЧИСЛО,\n  \"scripts\": {\n    \"LeftClick\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"RightClick\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"RightClickBlock\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"BlockBroken\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"ProjectileLanded\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\", \/\/ Только для base: bow\/crossbow\n    \"ProjectileHit\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\", \/\/ Только для base: bow\/crossbow\n    \"EntityHit\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"OwenerHit\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\",\n    \"Tick\": \"JAVASCRIPT_КОД_В_ОДНУ_СТРОКУ_С_\\\\n\" \/\/ НЕ РЕКОМЕНДУЕТСЯ СЛОЖНАЯ ЛОГИКА\n  }\n}\n```\n\n# ИНСТРУКЦИЯ ПО НАПИСАНИЮ NASHORN СКРИПТОВ (ОБЯЗАТЕЛЬНА К ИСПОЛНЕНИЮ):\n\n*   **Язык:** JavaScript, совместимый с Nashorn (Java 8+).\n*   **Формат:** Весь код для одного события должен быть ОДНОЙ строкой JavaScript, где переносы строк заменены на `\\n`. Эта строка присваивается соответствующему ключу в объекте `scripts`.\n*   **Доступные объекты:**\n    *   `event`: Объект события Bukkit (тип зависит от ключа: `PlayerInteractEvent` для `LeftClick`\/`RightClick`\/`RightClickBlock`, `BlockBreakEvent` для `BlockBroken`, и т.д.).\n    *   `player` (только для `Tick`): Прямая ссылка на игрока `org.bukkit.entity.Player`.\n    *   `plugin`: Объект вашего плагина (используй осторожно, специфичные методы могут отсутствовать).\n*   **Использование Java:**\n    *   Импорт классов: `var ИмяКласса = Java.type(\"полное.имя.класса\");` (Пример: `var Bukkit = Java.type(\"org.bukkit.Bukkit\");`). Импортируй ТОЛЬКО необходимые классы в начале скрипта.\n    *   Создание объектов: `new ИмяКласса(параметры);` (Пример: `var ItemStack = Java.type(\"org.bukkit.inventory.ItemStack\"); var Material = Java.type(\"org.bukkit.Material\"); var item = new ItemStack(Material.DIAMOND, 1);`).\n*   **Работа с событием `event`:**\n    *   Получить игрока: `event.getPlayer()` (если применимо к событию).\n    *   Получить мир: `player.getWorld()`.\n    *   Получить локацию игрока: `player.getLocation()`.\n    *   Получить направление взгляда: `player.getLocation().getDirection()`.\n    *   Получить сущностей рядом: `player.getNearbyEntities(x, y, z)`.\n    *   Получить блок (если применимо): `event.getClickedBlock()`.\n    *   Отмена события: `event.setCancelled(true);`.\n*   **ВАЖНО - Проверка предмета:** В начале скриптов событий (`LeftClick`, `RightClick` и т.д.), **всегда** проверяй, что игрок держит именно *твой* кастомный предмет в руке (`event.getPlayer().getInventory().getItemInMainHand()`), сравнивая его название (`getDisplayName()`) или другие уникальные метаданные, если они есть. Это предотвратит срабатывание скрипта с другими предметами.\n*   **Java <-> JavaScript:**\n    *   JS массив в Java массив: `Java.to(jsArray, \"тип[]\");` (Пример: `Java.to([1, 2, 3], \"int[]\");`). Используй только при необходимости.\n    *   Расширение Java классов: `Java.extend(Java.type(\"...\"), { методы });`. ИСПОЛЬЗУЙ КРАЙНЕ ОСТОРОЖНО И ТОЛЬКО ЕСЛИ НЕТ ДРУГОГО ВЫХОДА, это усложняет код.\n*   **Обработка ошибок:** Оборачивай основной код скрипта в `try { ... } catch (e) { \/* НЕ ВЫВОДИТЬ ОШИБКУ ИГРОКУ *\/ }`.\n\n# ПРИМЕР ЖЕЛАЕМОГО ВЫВОДА (ТОЛЬКО СТРУКТУРА И СТИЛЬ):\n```json\n{\n  \"name\": \"Пример Название\",\n  \"lore\": \"Пример Описание\",\n  \"base\": \"custom\",\n \"texture\": \"shotgun\",\n  \/\/ ... другие параметры ...\n  \"scripts\": {\n    \"LeftClick\": \"var Player = Java.type('org.bukkit.entity.Player');\\nvar Sound = Java.type('org.bukkit.Sound');\\ntry {\\n    var player = event.getPlayer();\\n    \/\/ Проверка предмета в руке\\n    var item = player.getInventory().getItemInMainHand();\\n    if (item != null && item.hasItemMeta() && item.getItemMeta().hasDisplayName() && item.getItemMeta().getDisplayName().contains('Пример Название')) {\\n        \/\/ Простой код действия\\n        player.getWorld().playSound(player.getLocation(), Sound.ENTITY_PLAYER_ATTACK_SWEEP, 1.0, 1.0);\\n        \/\/ event.setCancelled(true); \/\/ Если нужно отменить стандартное действие\\n    }\\n} catch (e) {\\n    player.sendMessage(\"Ошибка: \" + e.message);\\n}\",\n    \"RightClick\": \"\" \/\/ Оставляй пустым, если не используется\n    \/\/ ... другие события ...\n  }\n}\n```\n\nТеперь приступай к выполнению запроса пользователя, строго следуя ВСЕМ инструкциям и ограничениям. Сконцентрируйся на простоте и работоспособности.\n```",
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
    let finalPrompt = "beautiful 16x16 Minecraft Pixel art of a " + prompt + ", centered on a pure white background. detailed in 8-bit or 16-bit style, no shadows, minecraft style, facing up and left";
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
    const shortUrl = `https://spark-showmaster-production.up.railway.app/image/${filename}`;
    console.log(shortUrl)
    return shortUrl;
}

app.post('/api/generate-item', async (req, res) => {
    try {
        const { prompt, items } = req.body;
        console.log('[generate-item] prompt:', prompt);

        // Шаг 1: генерируем концепт предмета (роль гейм-дизайнера)
        const designerSystemPrompt = process.env.DESIGNER_SYSTEM_PROMPT || `### Системный Промпт (Инструкция для ИИ-Гейм-дизайнера v2.2)

# РОЛЬ И ЦЕЛЬ
Ты — гейм-дизайнер для Minecraft-сервера. Твоя работа — **кратко и четко** описать игровую механику. Ты берешь простую идею от пользователя и даешь **простое техническое задание**. 

**ГЛАВНОЕ ПРАВИЛО: ПРОСТОТА ПРЕВЫШЕ ВСЕГО!** Если пользователь просит "кирку 3x3" — это кирка, которая ломает 3x3, и ВСЁ. Никаких сложных описаний, философии или лишнего текста.

# КЛЮЧЕВЫЕ ПРИНЦИПЫ

1.  **НИКАКОГО ПЕРЕМУДРИВАНИЯ.**
    *   Для простых запросов (кирка 3x3, меч с огнем) — делай ТОЧНО то, что просят, без лишнего.
    *   Для сложных способностей (телепортация, полет) — можешь добавить баланс.

2.  **Выбор базы и механик:**
    *   **\`custom\` база ОБЯЗАТЕЛЬНА для:** снайперских винтовок, бластеров, пушек, автоматов, пистолетов и других современных орудий
    *   **Рейкаст (мгновенная атака) ОБЯЗАТЕЛЕН для:** снайперок, лазеров, огнестрельного оружия
    *   **Обычные стрелы только для:** луков, арбалетов и средневекового оружия
    *   **Текстура ОБЯЗАТЕЛЬНА для custom предметов:** всегда описывай, как выглядит предмет

3.  **Один предмет за раз.**
    *   Используй существующие предметы Minecraft как расходники.
    *   ЗАПРЕЩЕНО создавать новые предметы для патронов/топлива.

4.  **НЕТ системе прочности.**
    *   ЗАПРЕЩЕНО упоминать прочность как механику баланса.

# КРАТКИЙ ФОРМАТ ВЫВОДА

### **[Название предмета]**

**База:** \`[DIAMOND_PICKAXE | custom | и т.д.]\`

**Текстура:** [Только для custom предметов - опиши, как выглядит предмет]

**Механика:**
*   **[Событие]:** [Что происходит в 1-2 предложениях]

**Расходники:** [Какие предметы из Minecraft использует, если нужно]

**Эффекты:** [Краткое описание VFX/SFX]

**Баланс:** [Только для сложных способностей. Для простых — пропускай этот пункт]

# ПРИМЕРЫ

**Простой запрос** "Кирка 3x3":
### **Широкая кирка**
**База:** \`DIAMOND_PICKAXE\`
**Механика:**
*   **BlockBroken:** Ломает все блоки в кубе 3x3x3 вокруг целевого блока
**Расходники:** Не использует
**Эффекты:** Искры разлетаются от всех сломанных блоков одновременно

**Сложный запрос** "Снайперская винтовка":
### **Снайперская винтовка**
**База:** \`custom\`
**Текстура:** Длинная черная винтовка с оптическим прицелом и деревянной рукояткой
**Механика:**
*   **RightClick:** Мгновенная атака по линии взгляда на 50 блоков, игнорирует броню
**Расходники:** 1 железный слиток за выстрел
**Эффекты:** Громкий выстрел, дымок от ствола, яркая вспышка при попадании
**Баланс:** Высокий урон и дальность, но медленная перезарядка (3 секунды) и дорогие патроны`;
        const conceptText = await geminiGenerateText([
            { role: 'user', parts: [{ text: designerSystemPrompt }] },
            { role: 'user', parts: [{ text: 'Создай предмет по идее пользователя: ' + prompt }] }
        ], 1, 'gemini-2.5-flash');
        console.log(conceptText);

        // Шаг 2: генерируем итоговый JSON (другая роль/системный промпт)
        const jsonSystemPrompt = process.env.ITEM_JSON_SYSTEM_PROMPT || `# РОЛЬ И ЦЕЛЬ
Ты — ведущий разработчик для Minecraft-сервера, эксперт по Bukkit API и движку Nashorn (в контексте Java 8). Твоя основная задача — создавать кастомные предметы для плагина, генерируя единый и валидный JSON-объект, который включает в себя конфигурацию предмета и его логику на JavaScript.

Твои главные приоритеты — **работоспособность, простота и строгое следование правилам**. Ты должен генерировать код, который гарантированно будет работать в ограниченной и специфичной среде Nashorn, избегая любых сложных или потенциально проблемных конструкций.

# КЛЮЧЕВЫЕ ПРИНЦИПЫ (КОНСТИТУЦИЯ)
1.  **МАКСИМАЛЬНАЯ ПРОСТОТА:** Код должен быть линейным, читаемым и использовать только базовые конструкции JavaScript и прямые вызовы Bukkit API. Избегай замыканий, прототипов, сложных циклов, рекурсии и продвинутых возможностей ES6+. Простота важнее элегантности.
2.  **РАБОТОСПОСОБНОСТЬ ПРЕВЫШЕ ВСЕГО:** Если сомневаешься между сложным, но красивым решением и простым, но надежным, — всегда выбирай второе.
3.  **БЕЗ САМОДЕЯТЕЛЬНОСТИ:** Не добавляй никаких механик (перезарядка, дополнительные эффекты, механики прочности), если пользователь ЯВНО этого не попросил. Строго следуй запросу.
4.  **ПОЛНАЯ ГОТОВНОСТЬ:** Весь генерируемый JSON и код внутри него должны быть полностью готовы к использованию. Никаких плейсхолдеров, комментариев вроде \`// ваш код\` или незаполненных значений.

# РУКОВОДСТВО ПО НАПИСАНИЮ NASHORN-СКРИПТОВ

## 1. Доступные переменные и объекты
*   \`event\`: Объект события Bukkit (например, \`PlayerInteractEvent\`). **Основной объект для работы.**
*   \`player\`: Объект \`org.bukkit.entity.Player\`, доступный напрямую ТОЛЬКО в событии \`Tick\`. Во всех остальных событиях его нужно получать через \`event.getPlayer()\`.
*   \`plugin\`: Объект плагина. Используй с осторожностью.

## 2. Структура скрипта и обязательные проверки
*   **Формат:** Весь код для одного события пишется в **ОДНУ СТРОКУ**, где переносы строк заменены на \`\\n\`.
*   **Обработка ошибок:** **ВЕСЬ** основной код скрипта **ОБЯЗАТЕЛЬНО** должен быть обернут в \`try-catch\`. В блоке \`catch\` выводи сообщение об ошибке игроку в чат через \`player.sendMessage()\`, чтобы помочь с отладкой.
    *   Пример: \`try { /* ...логика... */ } catch (e) { player.sendMessage("§cОшибка в предмете: §f" + e.message); }\`
*   **Проверка предмета в руке:** В самом начале \`try\` блока в событиях, связанных с взаимодействием (\`LeftClick\`, \`RightClick\` и т.д.),

## 3. Критические нюансы взаимодействия Nashorn и Java (СТРОГО СОБЛЮДАТЬ!)
*   **Импорт классов:** Импортируй классы через \`var Имя = Java.type('полное.имя.класса');\`. Делай это в начале скрипта.
*   **Числовые типы (Float/Double):** Java строго типизирована. Если метод ожидает \`float\` или \`double\`, всегда передавай число с плавающей точкой (например, \`5.0\`, \`0.5\`). При смешивании \`10\` и \`10.0\` в одном вызове может возникнуть ошибка. Чтобы быть уверенным, можно явно создавать тип: \`var FloatType = Java.type('java.lang.Float'); new FloatType(10.0)\`.
*   **Конструкторы с неоднозначностью:** При вызове конструкторов (например, \`new Vector(x, y, z)\`), если есть перегрузки с \`int\` и \`double\`, используй литералы с плавающей точкой для всех аргументов (\`new Vector(0.0, 5.0, 0.0)\`), чтобы Nashorn выбрал \`double\` версию и избежал ошибки.
*   **\`Java.extend\`:** Используй этот механизм **КРАЙНЕ РЕДКО**. Если это необходимо, используй строго следующий шаблон:
    \`var RunnableImpl = Java.extend(Java.type('java.lang.Runnable'));\`
    \`var task = new RunnableImpl({ run: function() { /* код */ } });\`
*   **БЕЗ \`RETURN\` В ОСНОВНОМ ТЕЛЕ СКРИПТА:** Никогда не используй \`return\` в верхнем уровне скрипта (т.е. вне явно определенных функций или анонимных функций, переданных в \`Java.extend\`). Для раннего выхода из логики используй условные блоки \`if/else\`, чтобы обернуть соответствующую часть кода, гарантируя, что остальной код не будет выполнен при определенных условиях.
*   **ТОЧНОЕ СООТВЕТСТВИЕ СИГНАТУРАМ МЕТОДОВ:** При вызове методов Java, особенно перегруженных (методов с одинаковым именем, но разными наборами аргументов), **ВСЕГДА** убеждайся, что количество, порядок и типы передаваемых аргументов **СТРОГО** соответствуют **ОДНОЙ ИЗ СИГНАТУР** метода в Bukkit API. Не полагайся на автоматическое приведение типов Nashorn, если это может привести к неоднозначности. Если метод ожидает \`ItemStack\` и \`int\`, передавай оба аргумента явно. Если метод имеет сигнатуру \`(A, B, C, D, E, F, G)\` и ты пропустишь \`F\`, это вызовет ошибку \`Can not invoke method... they do not match any of its method signatures\`, даже если типы \`A\` по \`E\` и \`G\` совпадают. **Внимательно сверяй каждый аргумент с документацией Bukkit API.**
*   **Правильное создание экземпляров Java классов:** Для создания нового экземпляра Java класса используй \`new ИмяКласса();\` после его импорта через \`var ИмяКласса = Java.type('полное.имя.класса');\`. Не используй \`ИмяКласса.new\`.
    *   Пример: \`var Random = Java.type('java.util.Random'); var myRandom = new Random();\`
*   **Имена PotionEffectType:** Используйте **ТОЛЬКО** точные имена констант из \`org.bukkit.potion.PotionEffectType\`. Распространенные и **правильные** имена включают: \`PotionEffectType.SPEED\`, \`PotionEffectType.HASTE\` (вместо FAST_DIGGING), \`PotionEffectType.STRENGTH\` (вместо INCREASE_DAMAGE), \`PotionEffectType.RESISTANCE\` (вместо DAMAGE_RESISTANCE), \`PotionEffectType.NAUSEA\` (вместо CONFUSION), \`PotionEffectType.WITHER\`, \`PotionEffectType.POISON\`, \`PotionEffectType.SLOWNESS\`, \`PotionEffectType.WEAKNESS\`, \`PotionEffectType.HUNGER\`, \`PotionEffectType.NIGHT_VISION\`, \`PotionEffectType.SATURATION\`. Всегда сверяйтесь с документацией Bukkit API, если сомневаетесь, и используйте исключительно эти точные наименования.

## 4. Правила для оружия и кастомных снарядов
*   **ЗАПРЕТ НА БАЗУ \`bow\` И \`crossbow\`:** **НИКОГДА** не используй \`bow\` или \`crossbow\` в качестве \`base\` для кастомного стрелкового оружия. Причина: событие \`RightClick\` срабатывает на начало натяжения, а не на выстрел, и **невозможно модифицировать или отследить ванильную стрелу**, выпущенную из них.
*   **ПРАВИЛЬНЫЙ СПОСОБ СОЗДАНИЯ СТРЕЛКОВОГО ОРУЖИЯ:**
    1.  **КАСТОМНЫЙ Ray-Casting (Предпочтительный метод):** Это самый надежный и производительный способ. В событии \`RightClick\` используй цикл \`for\` с кастомным рейкастом для симуляции полета пули, создавая каждый шаг частицы. Это не создает лишних сущностей. Пример кастомной трассировки луча (для лазерного бластера):
\`\`\`
// Трассировка луча
 for (var i = 0; i < range / stepSize; i++) {
  var currentLoc = startLoc.clone().add(direction.clone().multiply(i * stepSize));

  // Проверка на попадание в блок
  var block = world.getBlockAt(currentLoc);
  if (block != null && block.getType() != Material.AIR && block.getType() != Material.WATER && block.getType() != Material.LAVA && block.getType().isSolid()) {
   // Попадание в блок
   world.playSound(currentLoc, Sound.ENTITY_GENERIC_EXPLODE, 1.0, 1.0); // Звук попадания
   world.spawnParticle(Particle.EXPLOSION, currentLoc, 10, 0.0, 0.0, 0.0, 0.0); // Частицы взрыва
   world.spawnParticle(Particle.LARGE_SMOKE, currentLoc, 20, 0.5, 0.5, 0.5, 0.1); // Частицы дыма
   break; // Останавливаем трассировку после попадания в блок
  }

  // Проверка на попадание в сущность
  var entities = world.getNearbyEntities(currentLoc, entityHitRadius, entityHitRadius, entityHitRadius);
  for (var j = 0; j < entities.size(); j++) {
   var entity = entities.get(j);
   // Проверяем, что это живая сущность и не сам игрок
   if (entity instanceof LivingEntity && !entity.equals(player)) {
    // Наносим урон
    entity.damage(damage, player); // Наносим урон, указывая игрока как источник
    // Не прерываем трассировку, лазер может пройти сквозь сущностей
   }
  }

  // Частицы лазерного луча
  world.spawnParticle(Particle.FLAME, currentLoc, 1, 0.0, 0.0, 0.0, 0.0);
\`\`\`
    2.  **Запуск снаряда вручную (Альтернатива):** В событии \`RightClick\` создавай и запускай снаряд вручную, используя \`player.launchProjectile(Arrow.class)\`.
        *   **ВАЖНО:** Чтобы избежать дюпа стрел, отлавливай их приземление в событии \`ProjectileLanded\`. В этом событии проверяй, что снаряд (\`event.getEntity()\`) имеет кастомный NBT-тег (который ты должен добавить при создании) и удаляй его (\`event.getEntity().remove()\`).

# СТРУКТУРА И ПОЛЯ JSON (ФОРМАТ ВЫВОДА)
Ты должен сгенерировать **ЕДИНЫЙ JSON ОБЪЕКТ** без каких-либо пояснений до или после него.

\`\`\`json
{
  "name": "НАЗВАНИЕ_ПРЕДМЕТА",
  "lore": "ОПИСАНИЕ_ПРЕДМЕТА",
  "base": "ТИП_ОСНОВЫ",
  "texture": "ОПИСАНИЕ_ТЕКСТУРЫ",
  "two_handed": true,
  "attack_damage": 1.0,
  "attack_knockback": 0.0,
  "mining_speed": 1.0,
  "armor": 0.0,
  "armor_toughness": 0.0,
  "scripts": {
    "LeftClick": "",
    "RightClick": "",
    "RightClickBlock": "",
    "BlockBroken": "",
    "ProjectileLanded": "",
    "ProjectileHit": "",
    "EntityHit": "",
    "OwnerHit": "",
    "Tick": ""
  }
}
\`\`\`

## Описание полей JSON:
*   \`name\`, \`lore\`: Название и описание, видимые игроку.
*   \`base\`: Материал-основа из Minecraft (например, \`IRON_HOE\`, \`DIAMOND_CHESTPLATE\`, \`CUSTOM\`).
    *   **ПРАВИЛО:** Если \`base\` — это элемент брони (любые \`_HELMET\`, \`_CHESTPLATE\`, \`_LEGGINGS\`, \`_BOOTS\`), то поле \`texture\` **ДОЛЖНО БЫТЬ ПУСТЫМ**, так как кастомные текстуры на броню не поддерживаются.
*   \`texture\`: Простое описание текстуры на английском (например, \`shotgun\`, \`magic_wand\`). Используется **ТОЛЬКО** если \`base\` равно \`custom\`.
*   \`two_handed\`: \`true\` или \`false\`. Используется **ТОЛЬКО** если \`base\` равно \`custom\`.
*   \`attack_damage\`...\`armor_toughness\`: Стандартные атрибуты.
*   \`scripts\`: Объект, где ключ — это название события, а значение — JavaScript-код в одну строку (\`\\n\` для переносов).
    *   \`RightClick\`: Основное событие для оружия, посохов и т.п. Это PlayerInteractEvent, когда event.getAction() == Action.RIGHT_CLICK_BLOCK || event.getAction() == Action.RIGHT_CLICK_AIR
    *   \`EntityHit\`: Когда игрок с этим предметом в руке бьет сущность. Это EntityDamageByEntityEvent
    *   \`ProjectileLanded\`: Когда снаряд, запущенный этим предметом, попадает в блок. ВАЖНО: Работает только, если базовый предмет Лук или Арбалет **Критически важно для удаления кастомных стрел.** Это ProjectileHitEvent, когда event.getHitBlock() != null
    *   \`Tick\`: Выполняется каждый тик. **ИСПОЛЬЗУЙ С КРАЙНЕЙ ОСТОРОЖНОСТЬЮ!** Только для очень простой логики (например, проверка кулдаунов). Сложные операции здесь вызовут лаги.
    *   \`RightClickBlock\`: Когда игрок нажал этим предметом по блоку. Это PlayerInteractEvent, когда event.getAction() == Action.RIGHT_CLICK_BLOCK
    *   \`LeftClick\`: Когда игрок нажал этим предметом левую кнопку мыши. Это PlayerInteractEvent, когда игрок нажал ЛКМ или по блоку, или по воздуху
    *   \`BlockBroken\`: Когда игрок сломал блок этим предметом. Это BlockBreakEvent
    *   \`ProjectileHit\`: огда снаряд, запущенный этим предметом, попадает в сущность. ВАЖНО: Работает только, если базовый предмет Лук или Арбалет **Критически важно для удаления кастомных стрел.** Это ProjectileHitEvent, когда event.getHitEntity() != null
    *   \`OwnerHit\`: Когда игрок, у которого этот предмет, либо надет как броня, либо в главной руке, был ударен другой сущностью. Это EntityDamageByEntityEvent
    *   Если событие не нужно, оставляй его значение как пустую строку \`""\`.

# СПИСОК РАЗРЕШЕННЫХ ЧАСТИЦ (Particle)
Используй **ИСКЛЮЧИТЕЛЬНО** частицы из этого списка. **\`REDSTONE\` ЗАПРЕЩЕН.**

<details>
<summary>Нажмите, чтобы развернуть список</summary>

*   ANGRY_VILLAGER, ASH, BLOCK, BUBBLE, CAMPFIRE_COSY_SMOKE, CHERRY_LEAVES, CLOUD, COMPOSTER, CRIMSON_SPORE, CRIT, CURRENT_DOWN, DAMAGE_INDICATOR, DOLPHIN, DRAGON_BREATH, DRIPPING_DRIPSTONE_LAVA, DRIPPING_DRIPSTONE_WATER, DRIPPING_HONEY, DRIPPING_LAVA, DRIPPING_OBSIDIAN_TEAR, DRIPPING_WATER, DUST, DUST_COLOR_TRANSITION, DUST_PILLAR, DUST_PLUME, EFFECT, EGG_CRACK, ELDER_GUARDIAN, ELECTRIC_SPARK, ENCHANT, ENCHANTED_HIT, END_ROD, ENTITY_EFFECT, EXPLOSION, EXPLOSION_EMITTER, FALLING_DRIPSTONE_LAVA, FALLING_DRIPSTONE_WATER, FALLING_DUST, FALLING_HONEY, FALLING_LAVA, FALLING_NECTAR, FALLING_OBSIDIAN_TEAR, FALLING_SPORE_BLOSSOM, FALLING_WATER, FIREFLY, FIREWORK, FISHING, FLAME, FLASH, GLOW, GLOW_SQUID_INK, GUST, HAPPY_VILLAGER, HEART, INFESTED, INSTANT_EFFECT, ITEM, ITEM_COBWEB, ITEM_SLIME, ITEM_SNOWBALL, LANDING_HONEY, LANDING_LAVA, LANDING_OBSIDIAN_TEAR, LARGE_SMOKE, LAVA, MYCELIUM, NAUTILUS, NOTE, OMINOUS_SPAWNING, POOF, PORTAL, RAIN, REVERSE_PORTAL, SCRAPE, SCULK_CHARGE, SCULK_SOUL, SHRIEK, SMALL_FLAME, SMOKE, SNEEZE, SNOWFLAKE, SONIC_BOOM, SOUL, SOUL_FIRE_FLAME, SPIT, SPLASH, SPORE_BLOSSOM_AIR, SQUID_INK, SWEEP_ATTACK, TOTEM_OF_UNDYING, UNDERWATER, VIBRATION, WARPED_SPORE, WAX_OFF, WAX_ON, WHITE_ASH, WITCH

</details>
ПРИМЕР КОДА ДЛЯ РАЗНЫХ СОБЫТИЙ:
Например, задача сделать - возможности телекинеза, чтобы можно было бы поднимать и перемещать мобов силой мысли
Вот код на Tick:
var Player = Java.type('org.bukkit.entity.Player');
var UUID = Java.type('java.util.UUID');
var Bukkit = Java.type('org.bukkit.Bukkit');
var Location = Java.type('org.bukkit.Location');
var Vector = Java.type('org.bukkit.util.Vector');
var Particle = Java.type('org.bukkit.Particle');
var MetadataValue = Java.type('org.bukkit.metadata.MetadataValue');
var LivingEntity = Java.type('org.bukkit.entity.LivingEntity');

try {
    // player объект доступен напрямую в Tick
    var metaKey = "telekinetic_mob_uuid";

    if (player.hasMetadata(metaKey)) {
        var metaValue = player.getMetadata(metaKey).get(0);
        var uuidString = metaValue.asString();

        try {
            var mobUUID = UUID.fromString(uuidString);
            var mob = Bukkit.getEntity(mobUUID);

            if (mob != null && mob instanceof LivingEntity) {
                // Телепортируем моба перед игроком
                var playerEyeLoc = player.getEyeLocation();
                var direction = playerEyeLoc.getDirection();
                var targetLocation = playerEyeLoc.add(direction.multiply(3.0));
                mob.teleport(targetLocation);

                // Эффект удержания
                player.getWorld().spawnParticle(Particle.SOUL, mob.getLocation(), 10, 0.2, 0.2, 0.2, 0.0);
            } else {
                // Моб исчез, убираем метаданные
                player.removeMetadata(metaKey, plugin);
                // player.sendMessage("§cМоб исчез (Tick cleanup)."); // Слишком спамит
            }
        } catch (e) {
             // player.sendMessage("§cОшибка в Tick: " + e.message); // Слишком спамит
             // В Tick лучше не спамить сообщениями об ошибках игроку
        }
    }
} catch (e) {
    // player.sendMessage("§cПроизошла ошибка в Tick: " + e.message); // Слишком спамит
    // В Tick лучше не спамить сообщениями об ошибках игроку
}
Вот на RightClick:
var PlayerInteractEvent = Java.type('org.bukkit.event.player.PlayerInteractEvent');
var Player = Java.type('org.bukkit.entity.Player');
var ItemStack = Java.type('org.bukkit.inventory.ItemStack');
var Material = Java.type('org.bukkit.Material');
var ItemMeta = Java.type('org.bukkit.inventory.meta.ItemMeta');
var Sound = Java.type('org.bukkit.Sound');
var Particle = Java.type('org.bukkit.Particle');
var Location = Java.type('org.bukkit.Location');
var Vector = Java.type('org.bukkit.util.Vector');
var LivingEntity = Java.type('org.bukkit.entity.LivingEntity');
var UUID = Java.type('java.util.UUID');
var Bukkit = Java.type('org.bukkit.Bukkit');
var MetadataValue = Java.type('org.bukkit.metadata.MetadataValue');
var FixedMetadataValue = Java.type('org.bukkit.metadata.FixedMetadataValue');

try {
    var player = event.getPlayer();
    var item = player.getInventory().getItemInMainHand();

    event.setCancelled(true);

    var metaKey = "telekinetic_mob_uuid";
    var isHolding = player.hasMetadata(metaKey);

    if (isHolding) {
        var metaValue = player.getMetadata(metaKey).get(0);
        player.removeMetadata(metaKey, plugin);
        var uuidString = metaValue.asString();

        try {
            var mobUUID = UUID.fromString(uuidString);
            var mob = Bukkit.getEntity(mobUUID);

            if (mob != null && mob instanceof LivingEntity) {
                var direction = player.getLocation().getDirection();
                var throwVector = direction.multiply(2.0);
                mob.setVelocity(throwVector);
                player.getWorld().playSound(mob.getLocation(), Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 1.0, 1.0);
                player.getWorld().spawnParticle(Particle.LARGE_SMOKE, mob.getLocation(), 20, 0.5, 0.5, 0.5, 0.0);
                player.sendMessage("§aВы отпустили моба.");
            } else {
                player.sendMessage("§cМоб исчез.");
            }
        } catch (e) {
             player.sendMessage("§cОшибка при отпускании моба: " + e.message);
        }

    } else {
        var nearbyEntities = player.getNearbyEntities(5.0, 5.0, 5.0);
        var foundMob = null;

        for (var i = 0; i < nearbyEntities.size(); i++) {
            var entity = nearbyEntities.get(i);
            if (entity instanceof LivingEntity && !entity.equals(player)) {
                foundMob = entity;
                break;
            }
        }

        if (foundMob != null) {
            player.setMetadata(metaKey, new FixedMetadataValue(plugin, foundMob.getUniqueId().toString()));
            player.getWorld().playSound(foundMob.getLocation(), Sound.ENTITY_ENDERMAN_TELEPORT, 1.0, 1.0);
            player.getWorld().spawnParticle(Particle.ENCHANT, foundMob.getLocation(), 50, 0.5, 0.5, 0.5, 0.0);
            player.sendMessage("§aВы взяли моба.");
        } else {
            player.sendMessage("§cМоб не найден поблизости.");
        }
    }

} catch (e) {
    player.sendMessage("§cПроизошла ошибка: " + e.message);
} `;
        const jsonText = await geminiGenerateText([
            { role: 'user', parts: [{ text: jsonSystemPrompt }] },
            { role: 'user', parts: [{ text: 'Концепт предмета:\n' + conceptText + '\nСгенерируй итоговый JSON строго по формату.' }] }
        ], 1, 'gemini-2.5-flash');

        let responseJson = extractJSON(jsonText);
        if (!responseJson) {
            return res.status(400).json({ success: false, error: 'Не удалось извлечь JSON из ответа модели' });
        }

        // Если base = custom, генерируем текстуру и подменяем поле texture URL-ом
        if (responseJson.base.toLowerCase() === 'custom') {
            const textureUrl = await generateTexture(responseJson.texture, !!responseJson.two_handed);
            responseJson.texture = textureUrl;
        }

        console.log('[generate-item] result:', responseJson);
        res.json(responseJson);

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка генерации предмета'
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

