const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // keep under Vercel's request body limit
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-4o';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You are analyzing a college semester result / marksheet PDF from an Indian engineering college on a 10-point grading scale (O=10, A+=9, A=8, B+=7, B=6, C=5, U/RA/F/W=0 fail).

Extract every subject/course listed in the document, grouped by semester if the document shows semester grouping (e.g. "Semester I", "Sem 3", "III Semester"). For each subject return:
- name: the subject/course title, cleaned up (no course code, no extra whitespace)
- credit: the credit value as a number
- grade: one of exactly these letters: O, A+, A, B+, B, C, U (map any fail, reappear, arrear, absent, or withheld grade to "U")

Respond with ONLY valid JSON, no markdown code fences, no commentary, in exactly this shape:
{
  "semesters": [
    { "label": "Semester 1", "subjects": [ { "name": "string", "credit": number, "grade": "O" } ] }
  ]
}

If the document does not show a clear semester grouping, put everything under a single semester object labeled "Detected subjects".
If this document is not a result sheet / marksheet, or no subjects can be found, respond with exactly: { "semesters": [] }`;

async function handleParse(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Server missing OPENAI_API_KEY' });
    }

    const base64Pdf = req.file.buffer.toString('base64');

    const body = {
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this result PDF and extract the subjects as instructed.' },
            {
              type: 'file',
              file: {
                filename: req.file.originalname || 'result.pdf',
                file_data: `data:application/pdf;base64,${base64Pdf}`
              }
            }
          ]
        }
      ]
    };

    const openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI API error:', openaiRes.status, errText);
      return res.status(502).json({ success: false, error: 'AI service error' });
    }

    const data = await openaiRes.json();
    const textOut = data?.choices?.[0]?.message?.content;

    if (!textOut) {
      console.error('No text in OpenAI response:', JSON.stringify(data));
      return res.status(502).json({ success: false, error: 'No response from AI' });
    }

    let parsed;
    try {
      parsed = JSON.parse(textOut);
    } catch (e) {
      console.error('Failed to parse AI JSON output:', textOut);
      return res.status(502).json({ success: false, error: 'AI returned an unexpected format' });
    }

    return res.json({ success: true, semesters: parsed.semesters || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

// Handle regardless of exact path/trailing slash, since this whole
// function is dedicated to /api/parse-result on Vercel.
app.post('*', upload.single('file'), handleParse);
app.get('*', (req, res) => res.send('CGPA result-parser API is running.'));

module.exports = app;
