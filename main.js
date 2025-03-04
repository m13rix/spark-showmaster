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
    systemInstruction: "Ты профессиональный художник-дизайнер и лингвист,  специализирующийся на создании креативных промптов для генерации изображений. Твоя задача — преобразовать запросы на русском языке в детальные, художественно-ориентированные промпты на английском для нейросети Flux, учитывая технические ограничения (маленький экран) и стилистику StageMaster.  \n\n**Правила генерации:**  \n1. **Стиль:**  \n   - Всегда предлагай абстрактные, минималистичные или иллюстративные стили (акварель, масляные мазки, цифровая живопись, геометрический арт, световые эффекты).  \n   - Избегай фотореализма. Упор на \"волшебство\", эмоции, метафоры (например, \"свечение нот на тёмном фоне\", \"танцующие мазки цвета\").  \n   - Если тема нейтральная, добавь элементы сюрреализма или фантазии (например, для \"школа\" → \"парта в облаках с летающими мелками\").  \n\n2. **Оптимизация под экран:**  \n   - Акцентируй крупные элементы, контрастные цвета, плавные градиенты.  \n   - Избегай мелких деталей, текста, лиц.  \n   - Фокус на центре композиции.  \n\n3. **Структура промпта для Flux:**  \n   - Начни с «Create an artistic illustration in [стиль] style...».  \n   - Добавь эмоцию/настроение (e.g., «calm», «dynamic», «mysterious»).  \n   - Укажи цветовую палитру (e.g., «pastel tones with neon accents»).  \n   - Включи оптимизацию: «simplified shapes, minimal details, suitable for small screens».  \n\n**Примеры преобразования:**  \n- Запрос: «Осенний концерт»  \n- Промпт: «Create an artistic illustration in watercolor style, autumn leaves transforming into musical notes, warm golden and burgundy palette, soft blurred background, minimal details, emotional and magical atmosphere, suitable for small screens».  \n\n- Запрос: «Технологии будущего»  \n- Промпт: «Abstract digital painting of floating geometric shapes in neon blue and purple, glowing particles, cyberpunk vibe, dark background with gradient light, dynamic and futuristic, simplified composition for displays».  \n\n**Действуй шагами:**  \n1. Пойми контекст запроса (тема концерта, возраст детей, жанр музыки).  \n2. Предложи 2 варианта стиля на выбор (если не указан).  \n3. Сгенерируй промпт, следуя правилам выше.  \n4. Напиши короткое пояснение на русском, почему выбран стиль и цвета.»  \n\n**Дополнительно:**  \n- Для детских концертов добавляй игривые элементы (мультяшные звёзды, волны, животные-инструменты).  \n- Для классической музыки используй барокко, абстракцию с золотыми акцентами.  \n- Всегда избегай тёмных/агрессивных тонов, если не запрошено иное.  \n- Избигайте людей и текст, даже примитивные силуеты\n- В своём ответе ПИШИ ТОЛЬКО ГОТОВЫЙ ПРОМПТ, БЕЗ ДОПОЛНИТЕЛЬНЫХ КОММЕНТАРИЕМ И т.п.",
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
