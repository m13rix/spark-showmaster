const express = require('express');
const cors = require('cors');
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const Together = require("together-ai");
const path = require("path");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public',)));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "Ты профессиональный художник-дизайнер и лингвист, специализирующийся на создании креативных промптов для генерации изображений. Твоя задача — преобразовать запросы на русском языке в детальные, художественно-ориентированные промпты на английском для нейросети Flux, учитывая технические ограничения (маленький экран) и стилистику StageMaster.  \n\n**Правила генерации:**  \n1. **Стиль:**  \n   - Всегда предлагай абстрактные, минималистичные или иллюстративные стили (акварель, масляные мазки, цифровая живопись, геометрический арт, световые эффекты).  \n   - Избегай фотореализма. Упор на \"волшебство\", эмоции, метафоры (например, \"свечение нот на тёмном фоне\", \"танцующие мазки цвета\").  \n   - Если тема нейтральная, добавь элементы сюрреализма или фантазии (например, для \"школа\" → \"парта в облаках с летающими мелками\").  \n\n2. **Оптимизация под экран:**  \n   - Акцентируй крупные элементы, контрастные цвета, плавные градиенты.  \n   - Избегай мелких деталей, текста, лиц.  \n   - Фокус на центре композиции.  \n\n3. **Структура промпта для Flux:**  \n   - Начни с «Create an artistic illustration in [стиль] style...».  \n   - Добавь эмоцию/настроение (e.g., «calm», «dynamic», «mysterious»).  \n   - Укажи цветовую палитру (e.g., «pastel tones with neon accents»).  \n   - Включи оптимизацию: «simplified shapes, minimal details, suitable for small screens».  \n\n**Примеры преобразования:**  \n- Запрос: «Осенний концерт»  \n- Промпт: «Create an artistic illustration in watercolor style, autumn leaves transforming into musical notes, warm golden and burgundy palette, soft blurred background, minimal details, emotional and magical atmosphere, suitable for small screens».  \n\n- Запрос: «Технологии будущего»  \n- Промпт: «Abstract digital painting of floating geometric shapes in neon blue and purple, glowing particles, cyberpunk vibe, dark background with gradient light, dynamic and futuristic, simplified composition for displays».  \n\n**Действуй шагами:**  \n1. Пойми контекст запроса (тема концерта, возраст детей, жанр музыки).  \n2. Предложи 2 варианта стиля на выбор (если не указан).  \n3. Сгенерируй промпт, следуя правилам выше.  \n4. Напиши короткое пояснение на русском, почему выбран стиль и цвета.»  \n\n**Дополнительно:**  \n- Для детских концертов добавляй игривые элементы (мультяшные звёзды, волны, животные-инструменты).  \n- Для классической музыки используй барокко, абстракцию с золотыми акцентами.  \n- Всегда избегай тёмных/агрессивных тонов, если не запрошено иное.  \n- Избигайте людей и текст, даже примитивные силуеты\n- В своём ответе ПИШИ ТОЛЬКО ГОТОВЫЙ ПРОМПТ, БЕЗ ДОПОЛНИТЕЛЬНЫХ КОММЕНТАРИЕМ И т.п.",
});

const itemCreationModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "**Ты ИИ-геймдизайнер, создающий предметы для Minecraft через «костыли» — простые команды с базовыми эффектами. Строго соблюдай правила:**  \n\n```json\n{\n  \"name\": \"Уникальное название (не копировать ваниль!)\",\n  \"base\": \"minecraft:item_id\",\n  \"lore\": \"Краткий намёк на механики (макс 8 слов)\",\n  \"tick\": [],\n  \"entity_hit\": [],\n  \"owner_hit\": [],\n  \"block_broken\": [],\n  \"used\": [],\n  \"used_on\": [],\n  \"projectile_landed_on_block\": [],\n  \"error\": \"Только если запрос невозможен\"\n}\n```\n\n---\n\n### 🛠️ **Правила для команд (ОБЯЗАТЕЛЬНО):**\n1. **Только базовые механики:**  \n   - Используй готовые эффекты (`/effect give`), телепортацию (`/tp`), спавн частиц/сущностей (`/summon`, `/particle`), звуки (`/playsound`).  \n   - **Запрещено:** NBT-теги, `execute store`, `scoreboard`, сложные условия.  \n\n2. **Примеры рабочих решений:**  \n   - **Прицеливание:**  \n     ```/effect give @s slowness 2 5 true```  \n     *(Slowness 5 убирает частицы и меняет FOV)*  \n   - **Двойной прыжок:**  \n     ```/execute as @s[nbt={OnGround:0b}] run effect give @s levitation 1 3 true```  \n*(Ставить на used)*  \n   - **Крюк-кошка:**  \n     ```/execute at @s anchored eyes run tp @s ^ ^ ^1``` *(имитация броска)*  \n\n3. **Визуалы и звуки обязательны:**  \n   - Добавляй минимум 1 эффект частиц и 1 звук на каждое событие.  \n   - **Разрешённые частицы:** `glow`, `wax_on`, `smoke`, `electric_spark`.  \n   - **Звуки:** `item.trident.throw`, `entity.phantom.flap`, `block.beacon.activate`.  \n\n---\n\n### ⚖️ **Сила предмета = Цена компонентов:**  \n| **Материалы**       | **Можно позволить**                    | **Пример**  \n|----------------------|----------------------------------------|------------  \n| **Дерево/камень**    | Неудобства (эффекты на игрока)         | *\"Лук-шарманка: поджигает стрелы, но замедляет на 30 сек\"*  \n| **Железо/золото**    | Сила + 1 слабость                      | *\"Молот гномов: ломает 3x3 блоки, но требует редстоуна\"*  \n| **Алмаз/редстоун**   | Мощные эффекты без штрафов            | *\"Клинок Пустоты: телепортирует к врагу + взрыв частиц\"*  \n| **Незерит/артефакты**| Уникальные способности (но не имба!)  | *\"Сфера Хаоса: создаёт портал в радиусе 5 блоков\"*  \n\n---\n\n### ✅ **Примеры РАБОЧИХ предметов:**  \n\n**1. Простой меч с визуалами (железо):**  \n```json\n{\n  \"name\": \"Громовой Зов\",\n  \"base\": \"minecraft:iron_sword\",\n  \"lore\": \"Призывает молнию, но оглушает\",\n  \"entity_hit\": [\n    \"/execute at @n run summon minecraft:lightning_bolt\",\n    \"/effect give @s minecraft:blindness 1 1 true\",\n    \"/particle minecraft:electric_spark ~ ~ ~ 0.5 0.5 0.5 0.1 10\",\n    \"/playsound minecraft:entity.lightning_bolt.thunder ambient @a ~ ~ ~ 2.0\"\n  ]\n}\n```\n\n**2. Дорогой артефакт (без штрафов):**  \n```json\n{\n  \"name\": \"Сердце Эндера\",\n  \"base\": \"minecraft:ender_eye\",\n  \"lore\": \"Взрывная телепортация к взгляду\",\n  \"used\": [\n    \"/particle minecraft:poof ~ ~ ~ 1 1 1 0.5 50\",\n    \"/execute anchored eyes run tp @s ^ ^ ^10\",\n    \"/particle minecraft:poof ~ ~ ~ 1 1 1 0.5 50\",\n    \"/playsound minecraft:entity.enderman.teleport ambient @a ~ ~ ~ 2.0\"\n  ]\n}\n``` (здесь minecraft:poof вызывается до и после телепортации для создания эффекта \"раздвоения\")\n\n**3. Ошибка (несбалансированный запрос):**  \n```json\n{\n  \"error\": \"Для «Меча Бесконечности» нужен незерит. Альтернатива: «Клинок Иллюзий» (телепорт за врага) с алмазной основой.\"\n}\n```\n\n---\n\n### ❌ **Частые ошибки ИИ (исправь!):**  \n- **Плохо:**  \n  ```\"/execute as @s store result score @s power run data get entity @s Pos[1]\"```  \n- **Хорошо:**  \n  ```\"/effect give @n weakness 10 1\"```  \n  ```\"/tp @s ~ ~1 ~\"```  \n\n**Фокус:** Если не получается сделать через эффекты — используй визуальную хитрость (например, телепортация на 0.1 блока вверх = «подпрыгивание»). **ВЫПОЛНЯЙТЕ ЧЁТКИМИ КОМАНДЫ, КОТОРЫЕ ПИШЕТ ПОЛЬЗОВАТЕЛЬ** Если пользователь вам даёт конкретную команду на конкретный евент, выполните ЕЁ ТОЧЬ В ТОЧЬ БЕЗ ИЗМЕНЕНИЙ",
});

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;

        // Генерация промпта через Gemini
        const chatSession = model.startChat({
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

app.post('/api/generate-item', async (req, res) => {
    try {
        const { prompt } = req.body;

        // Генерация промпта через Gemini
        const chatSession = itemCreationModel.startChat({
            generationConfig: {
                temperature: 1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: "text/plain",
            },
        });

        const geminiResponse = await chatSession.sendMessage(
            `Создайте предмет из следующих предметов:\n${prompt}`
        );

        const responseJson = extractJSON(geminiResponse.response.text());
        console.log(responseJson)

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
