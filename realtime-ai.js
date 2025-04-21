const express = require('express');
const cors = require('cors');
const { JigsawStack } = require('jigsawstack');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const jigsaw = JigsawStack({
    apiKey: "sk_b055c31edb8289b670aaae81cd93ac87ab40e1affc60bb1d1b518a1c059118378cc0a832aa360763771fd652d5fe144f5af02cba21ff5ac8bf10538563b5723c0249czVAGCwZN0nwnXOCx"
});

app.post('/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Получаем бинарные данные изображения
        const response = await jigsaw.image_generation({
            prompt: prompt,
            steps: 1,
        });

        // Определяем Content-Type
        const contentType = 'image/png';

        // Отправляем бинарные данные напрямую
        res.set('Content-Type', contentType);
        res.send(response.data);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Image generation failed' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
