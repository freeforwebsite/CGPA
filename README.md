# CGPA result-parser — Vercel backend

Serverless function (no Express server to keep alive, no sleep/wake delay
like Render's free tier) that takes an uploaded result/marksheet PDF,
sends it to Gemini, and returns a structured list of subjects grouped by
semester.

## Endpoint

Once deployed, your endpoint is:
`https://your-project.vercel.app/api/parse-result`

- Method: POST
- Body: multipart/form-data, field name `file` (the PDF)

Response:
```json
{
  "success": true,
  "semesters": [
    { "label": "Semester 1", "subjects": [ { "name": "...", "credit": 4, "grade": "O" } ] }
  ]
}
```

## Deploy on Vercel

1. Push this folder to a new GitHub repo.
2. Vercel dashboard → **Add New → Project** → import the repo.
3. No build settings needed — Vercel auto-detects the `api/` folder as
   serverless functions.
4. Before deploying, add an environment variable:
   - Key: `GEMINI_API_KEY`
   - Value: your key from https://aistudio.google.com/apikey
5. Deploy. Note your live URL, e.g. `https://your-project.vercel.app`.

## Connect the frontend

In `cgpa-calculator.html`, set:
```js
const PARSE_API_URL = "https://your-project.vercel.app/api/parse-result";
```

## Note on file size

Vercel's Hobby plan limits request bodies to a few MB, so the upload
limit here is set to 4MB — enough for typical text-based result PDFs.
If you hit size errors on a large scanned PDF, let me know and we can
compress it client-side before upload.
